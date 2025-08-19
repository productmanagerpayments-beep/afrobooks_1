import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

/**
 * Покупка книги — интерактивный гид (светлая тема)
 * Главные идеи:
 * - Гайд-режим: крупные шаги и CTA «Дальше», «Назад», подсказки на каждом этапе.
 * - Сайдбар «Где сейчас деньги»: показывает, где находятся деньги в текущий момент.
 * - Лог с вкладками: Бизнес / Интеграции / Все. Пишем «человеческим» языком.
 * - Глоссарий: термины кликабельны, всплывает подсказка и «Подробнее».
 * - Дизайн «в духе 1xBet» в светлой палитре: чистый белый, насыщенный синий, акценты.
 */

/* ---------- ГLOSSARY ---------- */
const GLOSSARY = {
  idem: {
    title: "Идемпотентный ключ",
    text:
      "Уникальный ID запроса. Если нажать «Оплатить» несколько раз, повтор с тем же ключом не создаст второй платёж.",
    link: "https://ru.wikipedia.org/wiki/%D0%98%D0%B4%D0%B5%D0%BC%D0%BF%D0%BE%D1%82%D0%B5%D0%BD%D1%82%D0%BD%D0%BE%D1%81%D1%82%D1%8C",
  },
  bff: {
    title: "BFF (Backend for Frontend)",
    text:
      "Прослойка между фронтом и внутренними сервисами. Упрощает клиент и объединяет несколько вызовов в один.",
    link: "https://microservices.io/patterns/apigateway.html",
  },
  psp: {
    title: "Платёжный провайдер (PSP)",
    text:
      "Сервис, который авторизует и списывает платежи, общается с банками и управляет 3-D Secure.",
    link: "https://en.wikipedia.org/wiki/Payment_service_provider",
  },
  webhook: {
    title: "Вебхук",
    text:
      "Асинхронное уведомление на наш сервер о статусе платежа (captured/failed и др.).",
    link: "https://ru.wikipedia.org/wiki/Webhook",
  },
  intent: {
    title: "Payment Intent",
    text:
      "«Намерение» платежа с суммой, валютой и методом. Готовим до списания — процесс последовательный и безопасный.",
    link: "https://stripe.com/docs/payments/payment-intents",
  },
  auth: {
    title: "Авторизация",
    text:
      "Банк проверяет, можно ли списать деньги. Сумма временно блокируется, но ещё не списана окончательно.",
    link: "https://en.wikipedia.org/wiki/Authorization_hold",
  },
  capture: {
    title: "Capture (списание)",
    text:
      "Финальное списание средств после одобренной авторизации. Может быть сразу или отдельно.",
    link: "https://stripe.com/docs/payments/capture-later",
  },
  token: {
    title: "Токенизация",
    text:
      "Карт-данные заменяются токеном. Магазин не хранит PAN — безопаснее и проще по комплаенсу.",
    link: "https://en.wikipedia.org/wiki/Tokenization_(data_security)",
  },
  ds3: {
    title: "3-D Secure",
    text:
      "Подтверждение у банка (СМС/Push/FaceID), чтобы убедиться, что платит владелец карты.",
    link: "https://ru.wikipedia.org/wiki/3-D_Secure",
  },
  risk: {
    title: "Проверка риска",
    text:
      "Автоматические проверки (гео, частота, устройство, чёрные списки), чтобы отсеивать подозрительные операции.",
    link: "https://en.wikipedia.org/wiki/Fraud_detection",
  },
};

function Term({ k, children }) {
  const [open, setOpen] = useState(false);
  const item = GLOSSARY[k];
  if (!item) return <>{children}</>;
  return (
    <span className="term" onClick={() => setOpen((v) => !v)}>
      {children}
      {open && (
        <div className="popover">
          <div className="popover-title">{item.title}</div>
          <div className="popover-text">{item.text}</div>
          {item.link && (
            <a className="popover-link" href={item.link} target="_blank" rel="noreferrer">
              Подробнее →
            </a>
          )}
        </div>
      )}
    </span>
  );
}

/* ---------- СТАДИИ ДЕНЕЖНОГО ПОТОКА ---------- */
const MoneyStage = {
  USER: "У пользователя",
  SHOP: "В магазине",
  PSP: "В PSP",
  BANK_HOLD: "Холд в банке",
  CAPTURED: "Списано",
};

/* ---------- ПОШАГОВЫЙ СЦЕНАРИЙ ---------- */
const Steps = {
  CART: "Корзина",
  PAYMENT: "Оплата",
  AUTH: "3-D Secure",
  PROCESSING: "Ожидание вебхука",
  RESULT: "Результат",
};

const ResultKinds = { SUCCESS: "SUCCESS", FAIL: "FAIL", NONE: "NONE" };

const stepMeta = {
  [Steps.CART]: {
    title: "Подтверждение корзины",
    money: MoneyStage.USER,
    business: [
      "Показываем состав корзины, итоговую сумму, скидки и доставку.",
      "Пользователь готов подтвердить заказ."
    ],
    tech: [
      <>Запрос в <Term k="bff">BFF</Term> с <Term k="idem">идемпотентным ключом</Term> для фиксации суммы и подготовки черновика заказа.</>,
    ],
    cta: "Оформить заказ",
  },
  [Steps.PAYMENT]: {
    title: "Создание заказа и намерения платежа",
    money: MoneyStage.SHOP,
    business: [
      "Создаём заказ со статусом Pending.",
      "Выбор метода оплаты: сохранённая карта, Apple Pay, кошелёк.",
      "Запускаем антифрод-проверку."
    ],
    tech: [
      <>Формируем <Term k="intent">Payment Intent</Term>, <Term k="token">токенизируем</Term> карту.</>,
      "Передаём параметры в оркестратор оплаты."
    ],
    cta: "Оплатить",
  },
  [Steps.AUTH]: {
    title: "Подтверждение владельца (3-D Secure)",
    money: MoneyStage.PSP,
    business: [
      "Банк может запросить подтверждение личности.",
      "Пользователь подтверждает платёж FaceID / в приложении / кодом."
    ],
    tech: [
      <>PSP инициирует <Term k="ds3">3-D Secure</Term> через SDK/ACS банка.</>,
    ],
    cta: "Продолжить",
  },
  [Steps.PROCESSING]: {
    title: "Авторизация и ожидание вебхука",
    money: MoneyStage.BANK_HOLD,
    business: [
      "Деньги временно заблокированы (холд) — авторизация одобрена.",
      "Экран может ожидать — статус придёт вебхуком."
    ],
    tech: [
      <>PSP выполняет <Term k="auth">авторизацию</Term> и (чаще автоматически) <Term k="capture">capture</Term>.</>,
      <>Магазин узнаёт итог по <Term k="webhook">вебхуку</Term> — источник истины.</>,
    ],
    cta: "Ждём подтверждение…",
  },
  [Steps.RESULT]: {
    title: "Финализация",
    money: MoneyStage.CAPTURED,
    business: [
      "Заказ помечен как «Оплачен».",
      "Пользователю отправлена квитанция.",
    ],
    tech: [
      "Обновляем статус Order, публикуем событие для BI/аналитики.",
    ],
    cta: "Ещё раз",
  },
};

/* ---------- UI-Помощники ---------- */
const Button = ({ children, onClick, kind = "primary", disabled }) => (
  <button className={`btn btn-${kind}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

const Pill = ({ children }) => <span className="pill">{children}</span>;

const Section = ({ title, children, aside }) => (
  <div className="section">
    <div className="section-head">
      <h2>{title}</h2>
      <div className="section-aside">{aside}</div>
    </div>
    <div>{children}</div>
  </div>
);

/* ---------- Главный компонент ---------- */
export default function App() {
  const [step, setStep] = useState(Steps.CART);
  const [result, setResult] = useState(ResultKinds.NONE);

  // Флаги сценариев
  const [require3DS, setRequire3DS] = useState(true);
  const [force3DSFail, setForce3DSFail] = useState(false);
  const [declineAtAcquirer, setDeclineAtAcquirer] = useState(false);
  const [simulateTimeout, setSimulateTimeout] = useState(false);

  // Логи: тип (business|tech) и текст (ReactNode)
  const [log, setLog] = useState([]);
  const [logTab, setLogTab] = useState("all"); // all|business|tech

  const addLog = (type, text) =>
    setLog((l) => [...l, { type, text, ts: new Date().toLocaleTimeString() }]);

  useEffect(() => {
    // приветствие
    addLog("business", "Добро пожаловать! Пройдём путь оплаты шаг за шагом.");
  }, []);

  // «Где сейчас деньги» зависит от текущего шага
  const moneyStage = stepMeta[step].money;

  // Фильтрация лога
  const filteredLog = useMemo(() => {
    if (logTab === "all") return log;
    return log.filter((e) => e.type === logTab);
  }, [log, logTab]);

  // Переходы шагов
  const next = () => {
    if (step === Steps.CART) {
      addLog("business", "Пользователь подтвердил корзину. Создаём заказ (Pending).");
      addLog("tech", <>Frontend → <Term k="bff">BFF</Term>: POST /checkout (с <Term k="idem">idem-key</Term>).</>);
      setStep(Steps.PAYMENT);
      return;
    }
    if (step === Steps.PAYMENT) {
      addLog("business", "Запускаем проверку риска и подготавливаем платёж.");
      addLog("tech", <>BFF → Risk: прескоринг. Оркестратор: создаёт <Term k="intent">Payment Intent</Term>, делает <Term k="token">токенизацию</Term>.</>);
      if (require3DS) {
        setStep(Steps.AUTH);
        addLog("business", "Банк запросил подтверждение личности (3-D Secure).");
      } else {
        // без 3DS — сразу уходим в авторизацию
        authorize();
      }
      return;
    }
    if (step === Steps.AUTH) {
      if (force3DSFail) {
        addLog("business", "Пользователь не прошёл подтверждение 3-D Secure.");
        addLog("tech", "PSP: 3DS challenge → failed. Возвращаем отказ.");
        setResult(ResultKinds.FAIL);
        setStep(Steps.RESULT);
        return;
      }
      addLog("business", "Подтверждение 3-D Secure прошло успешно.");
      authorize();
      return;
    }
    if (step === Steps.PROCESSING) {
      // Ничего — ждём вебхук (симуляция setTimeout в authorize()).
      return;
    }
    if (step === Steps.RESULT) {
      // Сброс сценария
      reset();
      return;
    }
  };

  const back = () => {
    if (step === Steps.PAYMENT) return setStep(Steps.CART);
    if (step === Steps.AUTH) return setStep(Steps.PAYMENT);
    if (step === Steps.PROCESSING) return setStep(Steps.PAYMENT);
    if (step === Steps.RESULT) return setStep(Steps.PAYMENT);
  };

  // Авторизация и дальнейшая обработка
  const authorize = () => {
    addLog("tech", <>Оркестратор → <Term k="psp">PSP</Term>: AUTH request.</>);
    if (declineAtAcquirer) {
      addLog("business", "Банк отклонил авторизацию (например, недостаточно средств).");
      addLog("tech", "PSP/Банк: decline. Вернули отказ.");
      setResult(ResultKinds.FAIL);
      setStep(Steps.RESULT);
      return;
    }
    // 3DS уже пройден или не требуется
    addLog("tech", "PSP: auth_approved. Блокируем сумму (authorization hold).");
    setStep(Steps.PROCESSING);
    addLog("business", "Деньги заблокированы (холд). Ждём окончательное списание.");

    // Имитация capture + webhook
    setTimeout(() => {
      if (simulateTimeout) {
        addLog("business", "Клиентская вкладка могла быть закрыта — не страшно, вебхук всё равно придёт.");
      }
      if (result === ResultKinds.FAIL) return;

      // финальный исход
      addLog("tech", <>PSP → <Term k="webhook">Webhook</Term>: payment.captured.</>);
      addLog("tech", "Order: статус → Paid. Notifications: письмо пользователю.");
      setResult(ResultKinds.SUCCESS);
      setStep(Steps.RESULT);
      addLog("business", "Платёж успешно завершён. Заказ оплачен.");
    }, 1200);
  };

  const reset = () => {
    setStep(Steps.CART);
    setResult(ResultKinds.NONE);
    setLog([]);
    addLog("business", "Готово к новому сценарию. Начнём сначала!");
  };

  /* ---------- ВИЗУАЛ ---------- */
  return (
    <div className="app">
      <Topbar />
      <div className="container">
        <div className="layout">
          {/* Сайдбар: где деньги */}
          <MoneyPanel
            current={moneyStage}
            flags={{ require3DS, force3DSFail, declineAtAcquirer, simulateTimeout }}
          />

          {/* Центральная колонка: гайд */}
          <main className="main">
            <Progress step={step} />
            <Card title={stepMeta[step].title} subtitle={step}>
              <Checklist items={stepMeta[step].business} />
              <Divider />
              <Techlist items={stepMeta[step].tech} />
              <Controls
                step={step}
                nextLabel={stepMeta[step].cta}
                onNext={next}
                onBack={back}
                flags={{
                  require3DS, setRequire3DS,
                  force3DSFail, setForce3DSFail,
                  declineAtAcquirer, setDeclineAtAcquirer,
                  simulateTimeout, setSimulateTimeout
                }}
              />
            </Card>
          </main>

          {/* Правая колонка: лог и интеграции */}
          <aside className="aside">
            <Section
              title="События и интеграции"
              aside={<Pill>Frontend ↔ BFF ↔ PSP ↔ Банк</Pill>}
            >
              <IntegrationList />
            </Section>
            <Section
              title="Ход процесса"
              aside={
                <div className="tabs">
                  <button
                    className={logTab === "all" ? "tab active" : "tab"}
                    onClick={() => setLogTab("all")}
                  >Все</button>
                  <button
                    className={logTab === "business" ? "tab active" : "tab"}
                    onClick={() => setLogTab("business")}
                  >Бизнес</button>
                  <button
                    className={logTab === "tech" ? "tab active" : "tab"}
                    onClick={() => setLogTab("tech")}
                  >Интеграции</button>
                </div>
              }
            >
              <Log items={filteredLog} />
            </Section>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------- Верхушка ---------- */
function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">XB</span>
        <div className="titles">
          <div className="title">Checkout Simulator</div>
          <div className="subtitle">Покупка книги • светлая тема</div>
        </div>
      </div>
      <a className="toplink" href="https://ru.wikipedia.org/wiki/3-D_Secure" target="_blank" rel="noreferrer">
        Что такое 3-D Secure?
      </a>
    </header>
  );
}

/* ---------- Прогресс по шагам ---------- */
function Progress({ step }) {
  const order = [Steps.CART, Steps.PAYMENT, Steps.AUTH, Steps.PROCESSING, Steps.RESULT];
  const idx = order.indexOf(step);
  const pct = ((idx) / (order.length - 1)) * 100;
  return (
    <div className="progress">
      <div className="progress-rail">
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-steps">
        {order.map((s, i) => (
          <div key={s} className={`dot ${i <= idx ? "done" : ""}`} title={s} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Карточка ---------- */
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

/* ---------- Списки ---------- */
function Checklist({ items }) {
  return (
    <ul className="list">
      {items.map((it, i) => (
        <li className="list-item" key={i}>
          <span className="bullet">•</span>
          <span className="list-text">{it}</span>
        </li>
      ))}
    </ul>
  );
}
function Techlist({ items }) {
  return (
    <ul className="list tech">
      {items.map((it, i) => (
        <li className="list-item" key={i}>
          <span className="chip">API</span>
          <span className="list-text">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Разделитель ---------- */
const Divider = () => <div className="divider" />;

/* ---------- Кнопки шага + флаги сценариев ---------- */
function Controls({ step, nextLabel, onNext, onBack, flags }) {
  const {
    require3DS, setRequire3DS,
    force3DSFail, setForce3DSFail,
    declineAtAcquirer, setDeclineAtAcquirer,
    simulateTimeout, setSimulateTimeout
  } = flags;

  return (
    <div className="controls">
      <div className="toggles">
        <Toggle label="Требуется 3-D Secure" checked={require3DS} onChange={setRequire3DS} />
        <Toggle label="Провал 3-D Secure" checked={force3DSFail} onChange={setForce3DSFail} />
        <Toggle label="Отказ банка (decline)" checked={declineAtAcquirer} onChange={setDeclineAtAcquirer} />
        <Toggle label="Таймаут клиента" checked={simulateTimeout} onChange={setSimulateTimeout} />
      </div>
      <div className="cta">
        <Button kind="ghost" onClick={onBack} disabled={step === Steps.CART}>Назад</Button>
        <Button onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
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

/* ---------- Сайдбар: где сейчас деньги ---------- */
function MoneyPanel({ current, flags }) {
  const stages = [
    { id: MoneyStage.USER, note: "Деньги у покупателя" },
    { id: MoneyStage.SHOP, note: "Заказ создан, оплата готовится" },
    { id: MoneyStage.PSP, note: "Платёж у провайдера" },
    { id: MoneyStage.BANK_HOLD, note: "Авторизационный холд" },
    { id: MoneyStage.CAPTURED, note: "Списано" },
  ];
  return (
    <aside className="money">
      <h3>💸 Где сейчас деньги?</h3>
      <ul className="money-steps">
        {stages.map((s) => (
          <li key={s.id} className={`money-item ${current === s.id ? "active" : ""}`}>
            <div className="dot" />
            <div className="col">
              <div className="label">{s.id}</div>
              <div className="note">{s.note}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="money-hint">
        <b>Подсказка:</b> итоговый статус всегда приходит по <Term k="webhook">вебхуку</Term> — даже если вкладка закрыта.
      </div>
      <div className="flags">
        <div className="flag"><span/> Требуется 3DS — {flags.require3DS ? "да" : "нет"}</div>
        <div className="flag"><span/> Провал 3DS — {flags.force3DSFail ? "да" : "нет"}</div>
        <div className="flag"><span/> Decline банка — {flags.declineAtAcquirer ? "да" : "нет"}</div>
        <div className="flag"><span/> Таймаут клиента — {flags.simulateTimeout ? "да" : "нет"}</div>
      </div>
    </aside>
  );
}

/* ---------- Блок интеграций ---------- */
function IntegrationList() {
  const rows = [
    { left: "Frontend → BFF", right: "POST /checkout, idem-key", note: "идемпотентность, проверка корзины" },
    { left: "BFF → Order", right: "POST /orders (Pending)", note: "создание заказа" },
    { left: "BFF → Risk", right: "POST /risk/score", note: "предавторизационный прескоринг" },
    { left: "Orchestrator → PSP", right: "POST /payments (intent)", note: "создание намерения и токенизация" },
    { left: "PSP → Bank", right: "AUTH + 3-D Secure", note: "проверка карты/владельца" },
    { left: "PSP → Shop", right: "Webhook: captured/failed", note: "источник истины по статусу" },
    { left: "Shop → Notifications", right: "Email/SMS", note: "квитанция и подтверждение" },
  ];
  return (
    <div className="integration-list">
      {rows.map((r, i) => (
        <div key={i} className="integration-row">
          <div className="cell left">{r.left}</div>
          <div className="cell arrow">→</div>
          <div className="cell right">{r.right}</div>
          <div className="cell note">{r.note}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Лог ---------- */
function Log({ items }) {
  return (
    <div className="log">
      {items.length === 0 && <div className="muted">Здесь появятся события по мере прохождения сценария.</div>}
      {items.map((e, i) => (
        <div key={i} className={`log-row ${e.type}`}>
          <div className="ts">{e.ts}</div>
          <div className="text">{e.text}</div>
        </div>
      ))}
    </div>
  );
}
