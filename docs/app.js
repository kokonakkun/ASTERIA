(() => {
  'use strict';

  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const themeToggle = document.querySelector('[data-theme-toggle]');

  const resolvedTheme = () => {
    const selected = root.dataset.theme || 'system';
    return selected === 'system' ? (systemDark.matches ? 'dark' : 'light') : selected;
  };

  const syncTheme = () => {
    const resolved = resolvedTheme();
    root.dataset.resolvedTheme = resolved;
    if (themeMeta) themeMeta.content = resolved === 'dark' ? '#0d0c12' : '#fbf8ff';
    if (themeToggle) {
      const next = resolved === 'dark' ? 'ライト' : 'ダーク';
      themeToggle.setAttribute('aria-label', `${next}テーマに切り替える`);
      themeToggle.title = `${next}テーマに切り替える`;
    }
  };

  syncTheme();

  themeToggle?.addEventListener('click', () => {
    const next = resolvedTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('asteria-site-theme', next);
    syncTheme();
  });

  systemDark.addEventListener?.('change', () => {
    if ((root.dataset.theme || 'system') === 'system') syncTheme();
  });

  const header = document.querySelector('[data-header]');
  const syncHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 16);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  const reveals = [...document.querySelectorAll('.reveal')];
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    reveals.forEach((node) => node.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((node) => revealObserver.observe(node));
    window.setTimeout(() => reveals.forEach((node) => node.classList.add('is-visible')), 4000);
  }

  const navLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"]')];
  const navSections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`);
      });
    }, { rootMargin: '-25% 0px -60% 0px', threshold: [0.01, 0.2, 0.5] });
    navSections.forEach((section) => navObserver.observe(section));
  }

  const showcase = document.querySelector('[data-showcase]');
  const tabs = showcase ? [...showcase.querySelectorAll('[role="tab"]')] : [];
  const panels = showcase ? [...showcase.querySelectorAll('[role="tabpanel"]')] : [];
  const showcaseImage = showcase?.querySelector('[data-showcase-image]');
  const showcaseMedia = {
    bridge: { src: 'assets/bridge.png', alt: 'ASTERIA Bridgeのサービス連携画面' },
    spectrum: { src: 'assets/settings-light.png', alt: 'ASTERIAの色、テーマ、モーション設定画面' },
    search: { src: 'assets/dashboard-light.png', alt: 'ASTERIAのホームとコマンド導線' }
  };

  Object.values(showcaseMedia).forEach(({ src }) => {
    const preload = new Image();
    preload.src = src;
  });

  const selectTab = (selected, moveFocus = false) => {
    const key = selected.dataset.tab;
    tabs.forEach((tab) => {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== key; });

    const media = showcaseMedia[key];
    if (showcaseImage && media && showcaseImage.getAttribute('src') !== media.src) {
      showcaseImage.classList.add('is-changing');
      window.setTimeout(() => {
        showcaseImage.src = media.src;
        showcaseImage.alt = media.alt;
        showcaseImage.classList.remove('is-changing');
      }, reduceMotion.matches ? 0 : 150);
    }
    if (moveFocus) selected.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      let target = index;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[target], true);
    });
  });

  const inferRepository = () => {
    if (!location.hostname.endsWith('.github.io')) return null;
    const owner = location.hostname.slice(0, -'.github.io'.length);
    const repo = location.pathname.split('/').filter(Boolean)[0];
    return owner && repo ? { owner, repo } : null;
  };

  const repository = inferRepository();
  if (repository) {
    const repositoryUrl = `https://github.com/${repository.owner}/${repository.repo}`;
    document.querySelectorAll('[data-release-link]').forEach((link) => {
      link.href = `${repositoryUrl}/releases/latest`;
    });
    const sourceLink = document.querySelector('[data-source-link]');
    if (sourceLink) sourceLink.href = repositoryUrl;
    document.querySelectorAll('[data-repo-path]').forEach((link) => {
      link.href = `${repositoryUrl}/${link.dataset.repoPath}`;
    });
  }

  let toastTimer;
  const showToast = (message) => {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  document.querySelector('[data-copy-hash]')?.addEventListener('click', async () => {
    const hash = document.querySelector('[data-hash]')?.textContent.trim();
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      showToast('SHA-256をコピーしました');
    } catch {
      const range = document.createRange();
      const node = document.querySelector('[data-hash]');
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      showToast('SHA-256を選択しました');
    }
  });
})();
