import React, { useMemo, useRef, useState, useEffect } from "react";
import "./App.css";
import { createPortal } from "react-dom";

/* ---------------- Глоссарий ---------------- */
const GLOSSARY = {
  idem: {
    title: "Идемпотентный ключ",
    text: "Уникальный ID запроса. Повтор с тем же ключом не создаст второй платёж.",
    link: "https://ru.wikipedia.org/wiki/%D0%98%D0%B4%D0%B5%D0%BC%D0%BF%D0%BE%D1%82%D0%B5%D0%BD%D1%82%D0%BD%D0%BE%D1%81%D1%82%D1%8C",
  },
  bff: {
    title: "BFF (Backend For Frontend)",
    text: "Прослойка между фронтом и внутренними сервисами. Упрощает клиент, агрегирует вызовы.",
    link: "https://microservices.io/patterns/apigateway.html",
  },
  psp: {
    title: "Платёжный провайдер (PSP)",
    text: "Авторизация/списание, связь с платёжными сетями и банками, 3-D Secure.",
    link: "https://en.wikipedia.org/wiki/Payment_service_provider",
  },
  webhook: {
    title: "Вебхук",
    text: "Асинхронное уведомление от внешнего сервиса на наш сервер о статусе платежа.",
    link: "https://ru.wikipedia.org/wiki/Webhook",
  },
  intent: {
    title: "Payment Intent",
    text: "«Намерение» платежа: сумма/валюта/метод. Готовим до списания.",
    link: "https://stripe.com/docs/payments/payment-intents",
  },
  auth: {
    title: "Авторизация",
    text: "Банк проверяет возможность списания. Сумма временно блокируется.",
    link: "https://en.wikipedia.org/wiki/Authorization_hold",
  },
  capture: {
    title: "Capture (списание)",
    text: "Финальное списание средств после авторизации.",
    link: "https://stripe.com/docs/payments/capture-later",
  },
  token: {
    title: "Токенизация",
    text: "Карт-данные заменяются безопасным токеном (магазин не хранит PAN).",
    link: "https://en.wikipedia.org/wiki/Tokenization_(data_security)",
  },
  ds3: {
    title: "3-D Secure",
    text: "Подтверждение у банка (СМС/Push/FaceID), чтобы убедиться, что платит владелец.",
    link: "https://ru.wikipedia.org/wiki/3-D_Secure",
  },
  risk: {
    title: "Проверка риска",
    text: "Автоматические проверки (гео/частота/устройство/списки) для отсечения мошенничества.",
    link: "https://en.wikipedia.org/wiki/Fraud_detection",
  },
};

/* ---------- Компонент термина с автопозиционированием поповера ---------- */
function Term({ k, children }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState({});
  const wrapRef = useRef(null);
  const item = GLOSSARY[k];

  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const margin = 12;
    const popoverWidth = 320;
    const minH = 140;
    const maxHCap = 480;

    // Горизонталь
    const overflowRight = rect.left + popoverWidth > window.innerWidth - margin;
    const left = overflowRight ? rect.right - popoverWidth : rect.left;

    // Вертикаль
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    let openDown = true;
    if (spaceBelow < minH && spaceAbove > spaceBelow) openDown = false;

    const avail = openDown ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(minH, Math.min(avail - 8, maxHCap));

    const top = openDown ? rect.bottom + 6 : rect.top - maxHeight - 6;

    setStyle({
      position: "fixed",
      top,
      left: Math.max(8, left),
      width: Math.min(popoverWidth, window.innerWidth - 16),
      maxHeight,
      overflowY: "auto",
      zIndex: 9999, // поверх всего
    });
  }, [open]);

  // закрытие по ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!item) return <>{children}</>;

  return (
    <span ref={wrapRef} className="term" onClick={() => setOpen(v => !v)}>
      {children}
      {open &&
        createPortal(
          <div className="popover" style={style}>
            <div className="popover-title">{item.title}</div>
            <div className="popover-text">{item.text}</div>
            {item.link && (
              <a className="popover-link" href={item.link} target="_blank" rel="noreferrer">
                Подробнее →
              </a>
            )}
          </div>,
          document.body
        )}
    </span>
  );
}


/* ---------- Парсер [[ключ|Метка]] → текст + <Term/> ---------- */
function renderWithTerms(text) {
  if (!text) return null;
  const parts = [];
  const re = /\[\[(\w+)\|([^\]]+)\]\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<Term key={`${m.index}-${m[1]}`} k={m[1]}>{m[2]}</Term>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ---------------- Этапы ---------------- */
const Steps = {
  CATALOG: "CATALOG",
  CART: "CART",
  CUSTOMER: "CUSTOMER",
  PAYMENT: "PAYMENT",
  AUTH: "AUTH",
  PROCESSING: "PROCESSING",
  RESULT: "RESULT",
};
const ORDER = [Steps.CATALOG, Steps.CART, Steps.CUSTOMER, Steps.PAYMENT, Steps.AUTH, Steps.PROCESSING, Steps.RESULT];
const ResultKinds = { SUCCESS: "SUCCESS", FAIL: "FAIL", NONE: "NONE" };

/* ---------------- Главный компонент ---------------- */
export default function App() {
  const [step, setStep] = useState(Steps.CATALOG);
  const [result, setResult] = useState(ResultKinds.NONE);

  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState("reader@example.com");
  const [name, setName] = useState("Иван П.");
  const [method, setMethod] = useState("card_saved");

  const [require3DS, setRequire3DS] = useState(true);
  const [force3DSFail, setForce3DSFail] = useState(false);
  const [declineAtAcquirer, setDeclineAtAcquirer] = useState(false);
  const [simulateTimeout, setSimulateTimeout] = useState(false);

  const [log, setLog] = useState([]);
  const [tab, setTab] = useState("all"); // all | business | tech
  const ts = () => new Date().toLocaleTimeString();
  const addLog = (type, text) => setLog((l) => [...l, { type, text, ts: ts() }]);
  const filteredLog = useMemo(() => (tab === "all" ? log : log.filter((e) => e.type === tab)), [log, tab]);
  const go = (s) => setStep(s);

  /* ---- Бизнес-переходы ---- */
  const onAddToCart = () => {
    addLog("business", "Добавили книгу в корзину.");
    addLog("tech", "Frontend → [[bff|BFF]]: POST /cart/items (book_id, qty).");
    go(Steps.CART);
  };

  const onConfirmCart = () => {
    addLog("business", "Подтвердили корзину, зафиксировали сумму.");
    addLog("tech", "Frontend → [[bff|BFF]]: POST /checkout (с [[idem|idem-key]]). BFF → Order: создать заказ (Pending).");
    go(Steps.CUSTOMER);
  };

  const onCustomerContinue = () => {
    // ✅ Явно переводим на этап оплаты (фикс №1)
    addLog("business", `Сохранили контакты: ${name}, ${email}.`);
    addLog("tech", "BFF → Order: PATCH /orders/{id} (customer info).");
    setStep(Steps.PAYMENT);
  };

  const onPay = () => {
    addLog("business", "Выбрали способ оплаты. Запускаем оплату.");
    addLog("tech", "BFF → [[risk|Risk]]: прескоринг; Оркестратор: создать [[intent|Payment Intent]], выполнить [[token|токенизацию]].");
    if (require3DS) {
      addLog("business", "Банк запросил подтверждение (3-D Secure).");
      setStep(Steps.AUTH);
    } else {
      authorize();
    }
  };

  const authorize = () => {
    addLog("tech", "Оркестратор → [[psp|PSP]]: AUTH request.");
    if (declineAtAcquirer) {
      addLog("business", "Банк отклонил авторизацию (недостаточно средств/лимит/блокировка).");
      addLog("tech", "PSP/Банк: decline. Возврат отказа.");
      setResult(ResultKinds.FAIL);
      setStep(Steps.RESULT);
      return;
    }
    if (require3DS) {
      if (force3DSFail) {
        addLog("business", "Пользователь не прошёл 3-D Secure. Платёж отклонён.");
        addLog("tech", "3DS challenge → failed.");
        setResult(ResultKinds.FAIL);
        setStep(Steps.RESULT);
        return;
      }
      addLog("business", "3-D Secure подтверждён. Продолжаем.");
    }
    addLog("tech", "PSP: [[auth|auth_approved]]. Сумма заблокирована (authorization hold).");
    setStep(Steps.PROCESSING);

    setTimeout(() => {
      if (simulateTimeout) {
        addLog("business", "Клиент мог закрыть вкладку — статус придёт по [[webhook|вебхуку]].");
      }
      addLog("tech", "PSP → [[webhook|Webhook]]: payment.[[capture|captured]].");
      addLog("tech", "Order: статус → Paid. Notifications: чек пользователю.");
      setResult(ResultKinds.SUCCESS);
      setStep(Steps.RESULT);
      addLog("business", "Платёж завершён. Заказ оплачен.");
    }, 1200);
  };

  const reset = () => {
    setStep(Steps.CATALOG);
    setResult(ResultKinds.NONE);
    setLog([]);
  };

  /* ---- Метаданные шагов ---- */
  const meta = {
    [Steps.CATALOG]: {
      title: "Каталог",
      business: ["Пользователь видит книгу и добавляет её в корзину."],
      tech: ["Frontend → [[bff|BFF]]: POST /cart/items. BFF → Cart: пересчёт суммы и промо."],
      ui: (
        <div className="catalog">
          <div className="book">
            <div className="cover" />
            <div className="info">
              <div className="name">«Секреты архитектуры платежей»</div>
              <div className="meta">Бумажная, 352 стр. · ISBN 978-1-23456-789-7</div>
              <div className="price">1 299 ₽</div>
              <div className="qty">
                Кол-во:
                <input type="number" min="1" value={qty} onChange={(e) => setQty(parseInt(e.target.value || 1, 10))} />
              </div>
              <button type="button" className="btn btn-primary" onClick={onAddToCart}>В корзину</button>
            </div>
          </div>
        </div>
      ),
      cta: "В корзину",
      onNext: onAddToCart,
      back: null,
    },
    [Steps.CART]: {
      title: "Корзина",
      business: ["Проверяем состав заказа, промокоды и доставку (у нас — эльфами, бесплатно)."],
      tech: ["Cart: калькуляция total, налогов, промо."],
      ui: (
        <div className="cart">
          <div className="row">
            <div className="title">«Секреты архитектуры платежей»</div>
            <div className="qty">× {qty}</div>
            <div className="sum">1 299 ₽</div>
          </div>
          <div className="row promo">Промо −200 ₽</div>
          <div className="row">Доставка: 0 ₽ (эльфы)</div>
          <div className="total">Итого: 1 099 ₽</div>
        </div>
      ),
      cta: "Оформить заказ",
      onNext: onConfirmCart,
      back: () => setStep(Steps.CATALOG),
    },
    [Steps.CUSTOMER]: {
      title: "Данные покупателя",
      business: ["Собираем e-mail и имя для чека и уведомлений."],
      tech: ["BFF → Order: PATCH customer info."],
      ui: (
        <div className="form">
          <label>Имя<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>E-mail<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        </div>
      ),
      cta: "Далее",
      onNext: onCustomerContinue,
      back: () => setStep(Steps.CART),
    },
    [Steps.PAYMENT]: {
      title: "Оплата",
      business: ["Выбор метода оплаты: карта/кошелёк.", "Запускаем антифрод-проверку, готовим платёж."],
      tech: ["BFF → [[risk|Risk]]: прескоринг.", "Оркестратор: [[intent|Payment Intent]] + [[token|токенизация]]."],
      ui: (
        <div className="payment">
          <div className="pm-group">
            <label><input type="radio" name="pm" checked={method === "card_saved"} onChange={() => setMethod("card_saved")} /> Сохранённая карта •• 4242</label>
            <label><input type="radio" name="pm" checked={method === "apple"} onChange={() => setMethod("apple")} /> Apple Pay</label>
            <label><input type="radio" name="pm" checked={method === "wallet"} onChange={() => setMethod("wallet")} /> Электронный кошелёк</label>
          </div>
          <div className="flags">
            <Toggle label="Требуется 3-D Secure" checked={require3DS} onChange={setRequire3DS} />
            <Toggle label="Провал 3-D Secure" checked={force3DSFail} onChange={setForce3DSFail} />
            <Toggle label="Отказ банка (decline)" checked={declineAtAcquirer} onChange={setDeclineAtAcquirer} />
            <Toggle label="Таймаут клиента" checked={simulateTimeout} onChange={setSimulateTimeout} />
          </div>
        </div>
      ),
      cta: "Оплатить",
      onNext: onPay,
      back: () => setStep(Steps.CUSTOMER),
    },
    [Steps.AUTH]: {
      title: "3-D Secure",
      business: ["Банк подтверждает, что платит владелец карты."],
      tech: ["PSP инициирует [[ds3|3-D Secure]] через ACS банка."],
      ui: (
        <div className="auth">
          <div className="loader" />
          <div className="muted">Подтвердите оплату в приложении банка…</div>
        </div>
      ),
      cta: "Продолжить",
      onNext: () => authorize(),
      back: () => setStep(Steps.PAYMENT),
    },
    [Steps.PROCESSING]: {
      title: "Обработка",
      business: [
        "Деньги заблокированы (authorization hold). Ждём завершение списания.",
        "Даже при перезагрузке страницы итог придёт по вебхуку.",
      ],
      tech: ["PSP: [[auth|auth_approved]] → [[capture|capture]] (часто автоматически).", "PSP → Магазин: [[webhook|вебхук]] captured/failed."],
      ui: (
        <div className="processing">
          <div className="spinner" />
          <div>Обрабатываем платёж… ждём подтверждение от банка</div>
        </div>
      ),
      cta: "Ждём подтверждение…",
      onNext: () => {},
      back: () => setStep(Steps.PAYMENT),
    },
    [Steps.RESULT]: {
      title: result === ResultKinds.SUCCESS ? "Оплата подтверждена" : "Оплата не прошла",
      business: [result === ResultKinds.SUCCESS ? "Заказ оплачен. Квитанция отправлена на e-mail." : "Попробуйте другой метод оплаты или повторите позже."],
      tech: [result === ResultKinds.SUCCESS ? "Order: статус → Paid. BI: событие об оплате." : "Order: статус → Failed. Возможно повторить с новым intent."],
      ui: (
        <div className="result">
          {result === ResultKinds.SUCCESS ? <SuccessIcon /> : <FailIcon />}
          <div className="muted">{result === ResultKinds.SUCCESS ? "Спасибо за покупку!" : "Что-то пошло не так…"}</div>
        </div>
      ),
      cta: "Начать заново",
      onNext: reset,
      back: () => setStep(Steps.PAYMENT),
    },
  };

  const m = meta[step];

  return (
    <div className="shop">
      <Topbar />
      <div className="container">
        <div className="grid">
          <div className="col main">
            <Card title={m.title} subtitle={labelOf(step)}>
              {m.ui}
              <Divider />
              <TwoCols
                left={<Checklist title="Бизнес" items={m.business} />}
                right={<Techlist title="Интеграции" items={m.tech} />}
              />
              <div className="actions">
                <button type="button" className="btn btn-ghost" onClick={m.back} disabled={!m.back}>Назад</button>
                <button type="button" className="btn btn-primary" onClick={m.onNext}>{m.cta}</button>
              </div>
            </Card>
          </div>

          <div className="col side">
            <Card title="Ход процесса" subtitle="Лог">
              <div className="tabs">
                <button type="button" className={`tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>Все</button>
                <button type="button" className={`tab ${tab === "business" ? "active" : ""}`} onClick={() => setTab("business")}>Бизнес</button>
                <button type="button" className={`tab ${tab === "tech" ? "active" : ""}`} onClick={() => setTab("tech")}>Интеграции</button>
              </div>
              <Log items={filteredLog} />
            </Card>

            <Card title="Где сейчас деньги" subtitle="Денежный поток">
              <MoneyWhere step={step} />
            </Card>
          </div>
        </div>
      </div>

      <Roadmap step={step} onSelect={go} />
    </div>
  );
}

/* ---------------- Вспомогательные компоненты ---------------- */
function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">XB</span>
        <div className="titleblock">
          <div className="title">AfroBooks Market</div>
          <div className="subtitle">Интерактивный checkout • светлая тема</div>
        </div>
      </div>
      <a className="toplink" href="https://ru.wikipedia.org/wiki/3-D_Secure" target="_blank" rel="noreferrer">Что такое 3-D Secure?</a>
    </header>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-sub">{subtitle}</div>
          <h2 className="card-title">{title}</h2>
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
const Divider = () => <div className="divider" />;
function TwoCols({ left, right }) { return <div className="two"><div>{left}</div><div>{right}</div></div>; }

function Checklist({ title, items }) {
  return (
    <div>
      <div className="block-title">{title}</div>
      <ul className="list">
        {items.map((it, i) => (
          <li className="list-item" key={i}>
            <span className="bullet">•</span>
            <span className="list-text">{renderWithTerms(typeof it === "string" ? it : "")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function Techlist({ title, items }) {
  return (
    <div>
      <div className="block-title">{title}</div>
      <ul className="list tech">
        {items.map((it, i) => (
          <li className="list-item" key={i}>
            <span className="chip">API</span>
            <span className="list-text">{renderWithTerms(typeof it === "string" ? it : "")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Log({ items }) {
  return (
    <div className="log">
      {items.length === 0 && <div className="muted">Здесь появятся события.</div>}
      {items.map((e, i) => (
        <div key={i} className={`log-row ${e.type}`}>
          <div className="ts">{e.ts}</div>
          <div className="text">{renderWithTerms(typeof e.text === "string" ? e.text : "")}</div>
        </div>
      ))}
    </div>
  );
}

function MoneyWhere({ step }) {
  const map = {
    [Steps.CATALOG]: 0,
    [Steps.CART]: 0,
    [Steps.CUSTOMER]: 1,
    [Steps.PAYMENT]: 1,
    [Steps.AUTH]: 2,
    [Steps.PROCESSING]: 3,
    [Steps.RESULT]: 4,
  };
  const idx = map[step] ?? 0;
  const stages = ["У пользователя", "В магазине", "В PSP", "Холд в банке", "Списано"];
  return (
    <ul className="money-list">
      {stages.map((s, i) => (
        <li key={s} className={`money-item ${i === idx ? "active" : ""}`}>
          <div className="dot" />
          <div className="label">{s}</div>
        </li>
      ))}
    </ul>
  );
}

function Roadmap({ step, onSelect }) {
  const i = ORDER.indexOf(step);
  return (
    <div className="roadmap">
      <div className="road">
        {ORDER.map((s, idx) => (
          <div key={s} className={`node ${idx <= i ? "done" : ""}`} onClick={() => onSelect(s)}>
            <div className="n-dot" />
            <div className="n-label">{labelOf(s)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function labelOf(s) {
  switch (s) {
    case Steps.CATALOG: return "Каталог";
    case Steps.CART: return "Корзина";
    case Steps.CUSTOMER: return "Данные";
    case Steps.PAYMENT: return "Оплата";
    case Steps.AUTH: return "3-D Secure";
    case Steps.PROCESSING: return "Обработка";
    case Steps.RESULT: return "Результат";
    default: return s;
  }
}
function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`slider ${checked ? "on" : ""}`} />
      <span className="toggle-label">{label}</span>
    </label>
  );
}
function SuccessIcon() {
  return (
    <div className="icon success">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
    </div>
  );
}
function FailIcon() {
  return (
    <div className="icon fail">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </div>
  );
}
