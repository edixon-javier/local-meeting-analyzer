// Local Meeting Analyzer — Landing Page Interactions

document.addEventListener('DOMContentLoaded', () => {
  // Tabs switcher in App Mockup
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Close all other items
      faqItems.forEach(i => i.classList.remove('open'));
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });

  // Simulated Live Word Streaming in Transcription Tab
  const liveStreamingContainer = document.getElementById('streaming-text');
  if (liveStreamingContainer) {
    const textToStream = "Revisamos el rendimiento del backend en Python FastAPI y la latencia con Faster-Whisper. Los resultados en CPU son excelentes y todo el procesamiento se mantiene completamente local.";
    const words = textToStream.split(' ');
    let wordIndex = 0;

    function streamNextWord() {
      if (wordIndex < words.length) {
        liveStreamingContainer.textContent += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
        wordIndex++;
        setTimeout(streamNextWord, 250);
      } else {
        // Pause and reset
        setTimeout(() => {
          liveStreamingContainer.textContent = '';
          wordIndex = 0;
          streamNextWord();
        }, 6000);
      }
    }

    streamNextWord();
  }
});
