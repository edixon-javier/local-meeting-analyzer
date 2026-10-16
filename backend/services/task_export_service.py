"""
backend/services/task_export_service.py
Servicio de exportación e interoperabilidad directa de tareas y compromisos (iCalendar .ics y CSV).
Cumple con RFC 5545 para .ics y formato estándar compatible con Excel (UTF-8 con BOM) para .csv.
"""

import csv
import io
import os
import re
import uuid
import datetime
from typing import List, Dict, Any, Optional, Tuple


def normalize_action_item(item: Any, default_meeting_title: str = "", default_date: str = "") -> Dict[str, Any]:
    """
    Normaliza un compromiso/tarea tanto si es un diccionario estructurado como si es un string legado.
    """
    if isinstance(item, dict):
        task_text = str(item.get("task", "")).strip()
        assignee = str(item.get("assignee") or "Sin asignar").strip()
        deadline = str(item.get("deadline") or "Sin fecha").strip()
        completed = bool(item.get("completed", False))
        updated_at = item.get("updated_at")
    elif isinstance(item, str):
        task_text = item.strip()
        assignee = "Sin asignar"
        deadline = "Sin fecha"
        completed = False
        updated_at = None
    else:
        task_text = str(item or "").strip()
        assignee = "Sin asignar"
        deadline = "Sin fecha"
        completed = False
        updated_at = None

    return {
        "task": task_text,
        "assignee": assignee,
        "deadline": deadline,
        "completed": completed,
        "updated_at": updated_at,
        "meeting_title": default_meeting_title,
        "meeting_date": default_date
    }


SPANISH_MONTHS = {
    "enero": 1, "ene": 1,
    "febrero": 2, "feb": 2,
    "marzo": 3, "mar": 3,
    "abril": 4, "abr": 4,
    "mayo": 5, "may": 5,
    "junio": 6, "jun": 6,
    "julio": 7, "jul": 7,
    "agosto": 8, "ago": 8,
    "septiembre": 9, "setiembre": 9, "sep": 9, "set": 9,
    "octubre": 10, "oct": 10,
    "noviembre": 11, "nov": 11,
    "diciembre": 12, "dic": 12,
}


def sanitize_csv_cell(value: Any) -> Any:
    """
    Neutraliza inyección de fórmulas CSV (CWE-1236) y evita errores #NAME? en Microsoft Excel.
    Si el valor de texto comienza con =, +, -, @ o tabulación y no es un número, se antepone comilla simple.
    """
    if value is None:
        return ""
    val_str = str(value)
    if val_str and val_str[0] in ("=", "+", "-", "@", "\t"):
        try:
            float(val_str)
            return value
        except ValueError:
            return f"'{val_str}"
    return value


def parse_deadline_date(deadline_str: str) -> Optional[datetime.date]:
    """
    Intenta extraer una fecha válida de un texto de fecha límite.
    Soporta:
      - Formatos ISO YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (incluso con T u hora: YYYY-MM-DDTHH:MM:SS)
      - Formatos latinos DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY y con año de 2 dígitos (DD/MM/YY)
      - Días y meses con o sin relleno de cero (ej: 5/4/2026, 2026-5-4)
      - Fechas textuales en español (ej: '15 de octubre de 2026', '15 de octubre', '15 oct 2026')
      - Fechas relativas básicas ('hoy', 'mañana')
    """
    if not deadline_str:
        return None
    cleaned = deadline_str.strip().lower()
    if cleaned in ("sin fecha", "ninguna", "n/a", "none", "-"):
        return None

    today = datetime.date.today()
    if cleaned == "hoy":
        return today
    if cleaned in ("mañana", "manana"):
        return today + datetime.timedelta(days=1)

    # 1. ISO YYYY-MM-DD o YYYY/MM/DD o YYYY.MM.DD (con o sin hora / T)
    match_iso = re.search(r'\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])(?=[^\d]|$)', deadline_str)
    if match_iso:
        try:
            return datetime.date(int(match_iso.group(1)), int(match_iso.group(2)), int(match_iso.group(3)))
        except ValueError:
            pass

    # 2. DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, o con año de 2 dígitos DD/MM/YY
    match_latam = re.search(r'\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|\d{2})\b', deadline_str)
    if match_latam:
        try:
            y = int(match_latam.group(3))
            if y < 100:
                y += 2000
            return datetime.date(y, int(match_latam.group(2)), int(match_latam.group(1)))
        except ValueError:
            pass

    # 3. Formato textual en español: ej. '15 de octubre de 2026', '15 de octubre', '15 oct 2026'
    match_text = re.search(
        r'\b(0?[1-9]|[12]\d|3[01])\s+(?:de\s+)?([a-záéíóúñ]+)(?:\s+(?:del?\s+)?(20\d{2}|\d{2}))?\b',
        deadline_str,
        re.IGNORECASE
    )
    if match_text:
        day = int(match_text.group(1))
        m_name = match_text.group(2).lower()
        month = SPANISH_MONTHS.get(m_name)
        if month:
            y_str = match_text.group(3)
            if y_str:
                y = int(y_str)
                if y < 100:
                    y += 2000
            else:
                y = today.year
            try:
                return datetime.date(y, month, day)
            except ValueError:
                pass

    return None


def escape_ics_text(text: str) -> str:
    """
    Escapa caracteres especiales según la especificación RFC 5545 para propiedades de texto.
    """
    if not text:
        return ""
    # Reemplazar barra invertida primero
    escaped = text.replace("\\", "\\\\")
    # Escapar punto y coma, coma
    escaped = escaped.replace(";", "\\;").replace(",", "\\,")
    # Escapar saltos de línea
    escaped = escaped.replace("\r\n", "\\n").replace("\r", "\\n").replace("\n", "\\n")
    return escaped


def fold_ics_line(line: str) -> str:
    """
    Aplica line folding (plegado de líneas a 75 octetos) según RFC 5545.
    Las líneas plegadas continúan en la siguiente línea con un espacio en blanco.
    """
    line_bytes = line.encode("utf-8")
    if len(line_bytes) <= 75:
        return line

    chunks = []
    current_chunk = []
    current_len = 0
    max_len = 75

    for char in line:
        char_bytes = len(char.encode("utf-8"))
        if current_len + char_bytes > max_len:
            chunks.append("".join(current_chunk))
            current_chunk = [char]
            current_len = char_bytes
            max_len = 74  # El espacio de continuación cuenta como 1 octeto
        else:
            current_chunk.append(char)
            current_len += char_bytes

    if current_chunk:
        chunks.append("".join(current_chunk))

    return "\r\n ".join(chunks)


class TaskExportService:
    @staticmethod
    def filter_tasks(tasks: List[Dict[str, Any]], status_filter: Optional[str] = "all") -> List[Dict[str, Any]]:
        """
        Filtra una lista de tareas normalizadas por su estado: 'all', 'pending' o 'completed'.
        """
        if not status_filter or status_filter == "all":
            return tasks
        if status_filter == "pending":
            return [t for t in tasks if not t.get("completed")]
        if status_filter == "completed":
            return [t for t in tasks if bool(t.get("completed"))]
        return tasks

    @classmethod
    def export_to_csv(
        cls,
        tasks: List[Dict[str, Any]],
        meeting_title: Optional[str] = None,
        is_consolidated: bool = False
    ) -> str:
        """
        Genera el contenido CSV con BOM UTF-8 (\ufeff) para compatibilidad total con Microsoft Excel.
        """
        output = io.StringIO()
        writer = csv.writer(output, dialect="excel", lineterminator="\r\n")

        if is_consolidated:
            writer.writerow(["Reunión", "Fecha Reunión", "Nº", "Tarea / Compromiso", "Responsable", "Fecha Límite", "Estado"])
            for idx, task in enumerate(tasks, 1):
                meet_name = task.get("meeting_title") or meeting_title or "Reunión"
                meet_date = task.get("meeting_date") or ""
                estado = "Completada" if task.get("completed") else "Pendiente"
                writer.writerow([
                    sanitize_csv_cell(meet_name),
                    sanitize_csv_cell(meet_date),
                    idx,
                    sanitize_csv_cell(task.get("task", "")),
                    sanitize_csv_cell(task.get("assignee", "Sin asignar")),
                    sanitize_csv_cell(task.get("deadline", "Sin fecha")),
                    sanitize_csv_cell(estado)
                ])
        else:
            writer.writerow(["Nº", "Tarea / Compromiso", "Responsable", "Fecha Límite", "Estado"])
            for idx, task in enumerate(tasks, 1):
                estado = "Completada" if task.get("completed") else "Pendiente"
                writer.writerow([
                    idx,
                    sanitize_csv_cell(task.get("task", "")),
                    sanitize_csv_cell(task.get("assignee", "Sin asignar")),
                    sanitize_csv_cell(task.get("deadline", "Sin fecha")),
                    sanitize_csv_cell(estado)
                ])

        # Se antepone BOM UTF-8 (\ufeff) para que Excel abra acentos y ñ sin problemas
        return "\ufeff" + output.getvalue()

    @classmethod
    def export_to_ics(
        cls,
        tasks: List[Dict[str, Any]],
        meeting_title: Optional[str] = None,
        is_consolidated: bool = False,
        calendar_name: Optional[str] = None
    ) -> str:
        """
        Genera un calendario iCalendar (.ics) conforme a RFC 5545 con componentes VEVENT para
        compatibilidad directa con Google Calendar, Apple Calendar, Outlook y Thunderbird.
        """
        cal_title = calendar_name or (
            "Compromisos Consolidados" if is_consolidated else f"Compromisos - {meeting_title or 'Reunión'}"
        )
        now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        today = datetime.date.today()

        raw_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Local Meeting Analyzer//Compromisos//ES",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            f"X-WR-CALNAME:{escape_ics_text(cal_title)}",
            "X-WR-TIMEZONE:UTC",
        ]

        for idx, task in enumerate(tasks, 1):
            task_text = task.get("task", "").strip() or f"Compromiso {idx}"
            assignee = task.get("assignee", "Sin asignar")
            deadline_str = task.get("deadline", "Sin fecha")
            completed = bool(task.get("completed", False))
            parent_meeting = task.get("meeting_title") or meeting_title or "Reunión"

            # Determinar fecha del evento
            parsed_date = parse_deadline_date(deadline_str)
            if not parsed_date:
                # Si la tarea no tiene fecha parseable, usar la fecha de la reunión o el día de hoy
                meeting_raw_date = task.get("meeting_date")
                if meeting_raw_date:
                    parsed_date = parse_deadline_date(str(meeting_raw_date))
                if not parsed_date:
                    parsed_date = today

            start_str = parsed_date.strftime("%Y%m%d")
            next_day = parsed_date + datetime.timedelta(days=1)
            end_str = next_day.strftime("%Y%m%d")

            # Generar identificador único determinista o aleatorio
            task_uid = f"task-{idx}-{uuid.uuid4().hex[:12]}@local-meeting-analyzer"

            # Título resumido
            summary_tag = "[Compromiso - Completado]" if completed else "[Compromiso]"
            summary_parts = [f"{summary_tag} {task_text}"]
            if assignee and assignee != "Sin asignar":
                summary_parts.append(f"({assignee})")
            summary = " ".join(summary_parts)

            # Descripción enriquecida
            status_text = "Completada" if completed else "Pendiente"
            desc_lines = [
                f"Compromiso: {task_text}",
                f"Responsable: {assignee}",
                f"Fecha límite: {deadline_str}",
                f"Estado: {status_text}",
                f"Reunión origen: {parent_meeting}"
            ]
            description = "\n".join(desc_lines)

            # Conforme a RFC 5545 sección 3.8.3.8, en VEVENT los valores válidos de STATUS son
            # CONFIRMED, TENTATIVE y CANCELLED (COMPLETED solo es válido en VTODO).
            event_status = "CONFIRMED"

            event_lines = [
                "BEGIN:VEVENT",
                f"UID:{task_uid}",
                f"DTSTAMP:{now_utc}",
                f"DTSTART;VALUE=DATE:{start_str}",
                f"DTEND;VALUE=DATE:{end_str}",
                f"SUMMARY:{escape_ics_text(summary)}",
                f"DESCRIPTION:{escape_ics_text(description)}",
                f"STATUS:{event_status}",
            ]
            if completed:
                event_lines.append("X-STATUS:COMPLETED")
            event_lines.extend([
                "PRIORITY:1",
                "TRANSP:TRANSPARENT",
                "CATEGORIES:Compromisos,Reunión",
                "END:VEVENT"
            ])
            raw_lines.extend(event_lines)

        raw_lines.append("END:VCALENDAR")

        # Plegar cada línea si excede 75 octetos y unir con terminación CRLF (\r\n)
        folded = [fold_ics_line(line) for line in raw_lines]
        return "\r\n".join(folded) + "\r\n"

    @classmethod
    def get_meeting_tasks_for_export(
        cls,
        metadata: Dict[str, Any],
        meeting_title: str,
        status_filter: Optional[str] = "all"
    ) -> List[Dict[str, Any]]:
        """
        Extrae y normaliza las tareas de los metadatos de una reunión individual.
        """
        analysis = metadata.get("analysis") or {}
        raw_items = analysis.get("action_items") or []

        # Extraer fecha creada para metadatos
        created_ts = metadata.get("created")
        meeting_date_str = ""
        if created_ts:
            try:
                meeting_date_str = datetime.date.fromtimestamp(created_ts).strftime("%Y-%m-%d")
            except Exception:
                pass

        normalized = [
            normalize_action_item(item, default_meeting_title=meeting_title, default_date=meeting_date_str)
            for item in raw_items
        ]
        return cls.filter_tasks(normalized, status_filter)

    @classmethod
    def get_consolidated_tasks_for_export(
        cls,
        recordings_dir: str,
        metadata_repo: Any,
        status_filter: Optional[str] = "all",
        category_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Lee todas las grabaciones del directorio y consolida sus tareas en una única lista ordenada.
        """
        if not os.path.exists(recordings_dir):
            return []

        all_tasks = []
        for fname in sorted(os.listdir(recordings_dir), reverse=True):
            if not fname.lower().endswith(".json"):
                continue

            json_path = os.path.join(recordings_dir, fname)
            meta = metadata_repo.get_metadata(json_path)
            if not meta or not isinstance(meta, dict):
                continue

            analysis = meta.get("analysis") or {}
            category = analysis.get("category")
            if category_filter and category_filter != "All" and category != category_filter:
                continue

            raw_items = analysis.get("action_items") or []
            if not raw_items:
                continue

            # Título de la reunión
            audio_filename = meta.get("filename") or os.path.splitext(fname)[0] + ".wav"
            meeting_name = os.path.splitext(audio_filename)[0]

            created_ts = meta.get("created")
            meeting_date_str = ""
            if created_ts:
                try:
                    meeting_date_str = datetime.date.fromtimestamp(created_ts).strftime("%Y-%m-%d")
                except Exception:
                    pass

            for item in raw_items:
                normalized = normalize_action_item(
                    item,
                    default_meeting_title=meeting_name,
                    default_date=meeting_date_str
                )
                normalized["meeting_filename"] = audio_filename
                normalized["category"] = category
                all_tasks.append(normalized)

        return cls.filter_tasks(all_tasks, status_filter)
