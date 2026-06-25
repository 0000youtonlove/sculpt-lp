/**
 * SCULPT パーソナルジム LP — script.js
 *
 * 設計方針
 *   - DOMContentLoaded は1箇所にまとめて呼び出し
 *   - 各機能は独立した init* 関数に分離（単一責任）
 *   - スクロールイベントは requestAnimationFrame + ticking で最適化
 *   - prefers-reduced-motion を全アニメーションで考慮
 *   - 定数は先頭にまとめ、マジックナンバーを排除
 *
 * 機能一覧
 *   1. ヘッダー スクロール制御
 *   2. ハンバーガーメニュー
 *   3. FAQ アコーディオン（WAI-ARIA）
 *   4. フォーム バリデーション & 送信
 *   5. スクロールアニメーション（Intersection Observer）
 *   6. ページトップへ戻るボタン
 *   7. スムーススクロール
 *   8. スマホ固定CTAバー
 *   9. 数値カウントアップ
 */

'use strict';

/* ============================================================
  定数
  CSS の --header-h と同期すること
============================================================ */
const HEADER_HEIGHT    = 72;   // px：ヘッダー高さ（--header-h と同期）
const SCROLL_THRESHOLD = 60;   // px：ヘッダー背景が変わるスクロール量
const BACK_TO_TOP_SHOW = 500;  // px：トップ戻りボタンが出るスクロール量
const COUNT_DURATION   = 1200; // ms：カウントアップアニメーション時間

/* ============================================================
  ユーティリティ
============================================================ */

/**
 * RAF ベースのスクロールスロットリング
 * @param {() => void} fn - 実行する関数
 * @returns {EventListener}
 */
function onScrollRAF(fn) {
  let ticking = false;
  return () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        fn();
        ticking = false;
      });
      ticking = true;
    }
  };
}

/**
 * ease-out cubic
 * @param {number} t - 0〜1
 */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** prefers-reduced-motion の状態 */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
  エントリーポイント：DOMContentLoaded は1回だけ
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initHamburger();
  initFaq();
  initForm();
  initScrollReveal();
  initBackToTop();
  initSmoothScroll();
  initFixedCta();
  initCountUp();
});


/* ============================================================
  1. ヘッダー スクロール制御
     スクロール量が閾値を超えたら .is-scrolled を付与
============================================================ */
function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
  };

  update(); // 初期チェック
  window.addEventListener('scroll', onScrollRAF(update), { passive: true });
}


/* ============================================================
  2. ハンバーガーメニュー
============================================================ */
function initHamburger() {
  const hamburger  = document.querySelector('.hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;

  /** メニューの開閉状態を同期する */
  const setMenuState = (isOpen) => {
    hamburger.classList.toggle('is-open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    hamburger.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    mobileMenu.classList.toggle('is-open', isOpen);
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  const open  = () => setMenuState(true);
  const close = () => setMenuState(false);

  hamburger.addEventListener('click', () => {
    const isCurrentlyOpen = hamburger.getAttribute('aria-expanded') === 'true';
    isCurrentlyOpen ? close() : open();
  });

  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hamburger.getAttribute('aria-expanded') === 'true') {
      close();
      hamburger.focus(); // フォーカスをボタンへ戻す
    }
  });

  // メニュー外クリックで閉じる
  document.addEventListener('click', (e) => {
    if (
      hamburger.getAttribute('aria-expanded') === 'true' &&
      !hamburger.contains(e.target) &&
      !mobileMenu.contains(e.target)
    ) {
      close();
    }
  });

  // メニュー内リンクをタップしたら閉じる
  mobileMenu.querySelectorAll('.mobile-menu__link').forEach((link) => {
    link.addEventListener('click', close);
  });
}


/* ============================================================
  3. FAQ アコーディオン（WAI-ARIA: aria-expanded / hidden）
============================================================ */
function initFaq() {
  const buttons = document.querySelectorAll('.faq__btn');
  if (!buttons.length) return;

  const closeAll = () => {
    buttons.forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
      const target = document.getElementById(btn.getAttribute('aria-controls'));
      if (target) target.hidden = true;
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      const targetId   = btn.getAttribute('aria-controls');
      const target     = document.getElementById(targetId);
      if (!target) return;

      if (isExpanded) {
        // 閉じる
        btn.setAttribute('aria-expanded', 'false');
        target.hidden = true;
      } else {
        // 他を閉じてから開く（アコーディオン動作）
        closeAll();
        btn.setAttribute('aria-expanded', 'true');
        target.hidden = false;
      }
    });
  });
}


/* ============================================================
  4. フォーム バリデーション & 送信
============================================================ */
function initForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  /**
   * バリデーションルール
   * aria-describedby で紐付けた id のエラーメッセージ要素に出力
   */
  const RULES = {
    name: {
      required: true,
      message: 'お名前を入力してください',
    },
    tel: {
      required: true,
      pattern: /^[0-9\-+() ]+$/,
      message: '正しい電話番号を入力してください（例：090-1234-5678）',
    },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: '正しいメールアドレスを入力してください',
    },
  };

  /**
   * 1フィールドのバリデーション
   * @param {HTMLInputElement} input
   * @returns {boolean}
   */
  const validateField = (input) => {
    const rule    = RULES[input.name];
    const errorEl = document.getElementById(`${input.name}-error`);

    if (!rule) return true;

    const value = input.value.trim();
    let message = '';

    if (rule.required && !value) {
      message = rule.message;
    } else if (rule.pattern && value && !rule.pattern.test(value)) {
      message = rule.message;
    }

    const hasError = Boolean(message);
    input.classList.toggle('is-error', hasError);
    input.setAttribute('aria-invalid', String(hasError));
    if (errorEl) errorEl.textContent = message;

    return !hasError;
  };

  const inputs = form.querySelectorAll('.form__input');

  // blur 時にバリデーション
  inputs.forEach((input) => {
    input.addEventListener('blur', () => validateField(input));
    // 入力中はエラー解除
    input.addEventListener('input', () => {
      input.classList.remove('is-error');
      input.removeAttribute('aria-invalid');
      const errorEl = document.getElementById(`${input.name}-error`);
      if (errorEl) errorEl.textContent = '';
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // 全フィールド一括チェック
    const isValid = [...inputs].every((input) => validateField(input));

    if (!isValid) {
      // 最初のエラーフィールドへフォーカス
      const firstError = form.querySelector('.is-error');
      if (firstError) firstError.focus();
      return;
    }

    submitForm();
  });

  /** 送信処理（デモ：ローディング → 成功メッセージ） */
  const submitForm = () => {
    const submitBtn = form.querySelector('.form__submit');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '送信中...';
    }

    // 実際の実装では fetch() でAPIを呼ぶ
    setTimeout(() => {
      form.innerHTML = `
        <div
          class="form__success is-visible"
          role="alert"
          aria-live="polite"
          tabindex="-1"
        >
          <p>お申し込みありがとうございます。</p>
          <p style="font-size:0.875rem;color:var(--clr-text-2);margin-top:0.75rem;font-weight:300;">
            担当スタッフより24時間以内にご連絡いたします。
          </p>
        </div>
      `;
      // フォーカスを成功メッセージへ移動（スクリーンリーダー対応）
      const success = form.querySelector('[role="alert"]');
      if (success) success.focus();
    }, 1000);
  };
}


/* ============================================================
  5. スクロールアニメーション（Intersection Observer）
     .js-reveal がビューポートに入ったら .is-visible を付与
============================================================ */
function initScrollReveal() {
  if (prefersReducedMotion) {
    // アニメーション無効化：全要素を即表示
    document.querySelectorAll('.js-reveal').forEach((el) => {
      el.classList.add('is-visible');
    });
    return;
  }

  const targets = document.querySelectorAll('.js-reveal');
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // 1回だけ発火
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    },
  );

  targets.forEach((target) => observer.observe(target));
}


/* ============================================================
  6. ページトップへ戻るボタン
============================================================ */
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  const updateVisibility = () => {
    btn.hidden = window.scrollY <= BACK_TO_TOP_SHOW;
  };

  updateVisibility();
  window.addEventListener('scroll', onScrollRAF(updateVisibility), { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // フォーカスをスキップリンクへ（アクセシビリティ）
    setTimeout(() => {
      const skipLink = document.querySelector('.skip-link');
      if (skipLink) skipLink.focus();
    }, 500);
  });
}


/* ============================================================
  7. スムーススクロール
     href="#..." クリック時に固定ヘッダー分だけオフセット
============================================================ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');

      if (href === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      const top = target.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
      window.scrollTo({ top, behavior: 'smooth' });

      // フォーカス移動（アクセシビリティ）
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      setTimeout(() => target.focus({ preventScroll: true }), 400);
    });
  });
}


/* ============================================================
  8. スマホ固定CTAバー
     ヒーローを抜けたら表示 / フォームが見えたら非表示
============================================================ */
function initFixedCta() {
  const bar     = document.getElementById('fixed-cta');
  const hero    = document.querySelector('.hero');
  const contact = document.getElementById('contact');
  if (!bar || !hero) return;

  bar.hidden = false; // hidden を外して CSS transform で制御

  const update = () => {
    const heroBottom = hero.getBoundingClientRect().bottom;
    const nearForm   = contact
      ? contact.getBoundingClientRect().top < window.innerHeight * 0.85
      : false;

    bar.classList.toggle('is-visible', heroBottom < 0 && !nearForm);
  };

  window.addEventListener('scroll', onScrollRAF(update), { passive: true });
  update();
}


/* ============================================================
  9. 数値カウントアップ
     ヒーローの実績数値がビューに入ったとき 0 → 目標値へアニメーション
     data 属性でパラメータを HTML から渡す：
       data-count   : 目標値（数値）
       data-prefix  : 前置文字（例："−"）
       data-suffix  : 後置文字（例："%"）
       data-format  : "comma" なら 1,000 形式
       data-decimals: 小数点以下の桁数
============================================================ */
function initCountUp() {
  if (prefersReducedMotion) return;

  const stats = document.querySelectorAll('.hero__stat');
  if (!stats.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const strong = entry.target.querySelector('strong[data-count]');
        if (!strong) return;

        const target   = parseFloat(strong.dataset.count);
        const prefix   = strong.dataset.prefix  ?? '';
        const suffix   = strong.dataset.suffix  ?? '';
        const isComma  = strong.dataset.format  === 'comma';
        const decimals = parseInt(strong.dataset.decimals ?? '0', 10);

        let startTime = null;

        const step = (timestamp) => {
          if (!startTime) startTime = timestamp;
          const elapsed  = timestamp - startTime;
          const progress = Math.min(elapsed / COUNT_DURATION, 1);
          const current  = target * easeOutCubic(progress);

          let display = decimals > 0
            ? current.toFixed(decimals)
            : String(Math.floor(current));

          if (isComma) {
            display = parseInt(display, 10).toLocaleString('ja-JP');
          }

          strong.textContent = prefix + display + suffix;

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            // 終値を確定（浮動小数点誤差回避）
            strong.textContent = prefix + (
              isComma
                ? target.toLocaleString('ja-JP')
                : decimals > 0
                  ? target.toFixed(decimals)
                  : String(target)
            ) + suffix;
          }
        };

        requestAnimationFrame(step);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.5 },
  );

  stats.forEach((stat) => observer.observe(stat));
}
