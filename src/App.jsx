// src/App.jsx
// -----------------------------------------------------------------------------
// Book Checkout Simulator — стиль 1xBet, дружелюбные логи и глоссарий терминов
// Цель: показать весь процесс "от Оформить до Подтверждено" простым языком,
// при этом сохранить реалистичную архитектуру: BFF → Order/Risk/Orchestrator → PSP → Банк → Webhooks.
// -----------------------------------------------------------------------------
//
// Что внутри:
// 1) Верхняя плашка с градиентом и хедером.
// 2) «Экран смартфона» с пошаговым сценарием: Корзина → Оплата → 3DS → Обработка → Результат.
// 3) Поясняющие бейджи "✳︎ Explain" по каждому шагу.
// 4) Правый сайдбар: понятный лог, кликабельные термины (с подсказками).
// 5) Переключатели альтернатив: требовать 3DS, провал 3DS, отказ банка, таймаут клиента.
// 6) Хорошая идемпотентность в объяснениях, зависимость результата только от вебхука.
//
// Дизайн: темно-синий фон, электрический синий акцент, «неоновые» тени и контрастные CTA-кнопки.
// -----------------------------------------------------------------------------

import React, { useState } from "react";

// ---------------------------
// Мелкие UI-помощники (скин)
// ---------------------------
const Badge = ({ children, className = "", ...props }) => (
  <span
    {...props}
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${className}`}
  >
    {children}
  </span>
);

const Button = ({ children, onClick, variant = "primary", disabled }) => {
  const base =
    "px-3 py-2 rounded-xl text-sm font-semibold tracking-wide shadow-sm transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "bg-[#0B6FE4] hover:bg-[#0a63cb] text-white shadow-[0_6px_18px_0_rgba(11,111,228,0.35)]",
    ghost:
      "bg-[#0F1B2B] text-[#CFE8FF] hover:bg-[#14253a] border border-transparent",
    outline:
      "border border-[#1F5FAE] text-[#E6F3FF] hover:bg-[#0F1B2B]",
    success:
      "bg-[#10B981] hover:bg-[#0ea271] text-white",
    danger:
      "bg-[#EF4444] hover:bg-[#d93b3b] text-white",
  };
  return (
    <button className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

const Switch = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <span className={`w-12 h-7 rounded-full p-1 transition ${checked ? "bg-[#0B6FE4]" : "bg-[#163A6B]"}`}>
      <span className={`h-5 w-5 bg-white rounded-full block transition ${checked ? "translate-x-5" : "translate-x-0"}`}></span>
    </span>
    <span className="text-sm text-[#CFE8FF]">{label}</span>
    <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

const Chip = ({ children, tone = "default" }) => {
  const tones = {
    default: "border-[#1B3B66] text-[#CFE8FF]",
    info: "border-[#39BDF8] text-[#8FD9FF]",
    warn: "border-[#FFC247] text-[#FFD88A]",
    ok: "border-[#34D399] text-[#7EE7C4]",
    bad: "border-[#F87171] text-[#FFB3B3]",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
};

// ------------------------------------
// Глоссарий и кликабельные определения
// ------------------------------------
const GLOSSARY = {
  idem: {
    title: "Идемпотентный ключ",
    text:
      "Уникальный ID запроса. Если пользователь нажмёт «Оплатить» несколько раз или связь прервётся, повтор с тем же ключом не создаст второй платёж.",
    link: "https://ru.wikipedia.org/wiki/%D0%98%D0%B4%D0%B5%D0%BC%D0%BF%D0%BE%D1%82%D0%B5%D0%BD%D1%82%D0%BD%D0%BE%D1%81%D1%82%D1%8C",
  },
  bff: {
    title: "BFF (Backend For Frontend)",
    text:
      "Прослойка между фронтендом и внутренними сервисами. Упрощает клиент, объединяет несколько вызовов в один.",
    link: "https://microservices.io/patterns/apigateway.html",
  },
  psp: {
    title: "Платёжный провайдер (PSP)",
    text:
      "Сторонний сервис, который авторизует/списывает платежи, общается с банками и управляет 3-D Secure.",
    link: "https://en.wikipedia.org/wiki/Payment_service_provider",
  },
  webhook: {
    title: "Вебхук",
    text:
      "Асинхронное уведомление от внешнего сервиса на наш сервер о статусе события (например, «оплата списана»).",
    link: "https://ru.wikipedia.org/wiki/Webhook",
  },
  intent: {
    title: "Payment Intent (намерение платежа)",
    text:
      "Объект платежа: сумма, валюта и метод. Его готовят до списания — это делает процесс последовательным и безопасным.",
    link: "https://stripe.com/docs/payments/payment-intents",
  },
  auth: {
    title: "Авторизация",
    text:
      "Проверка банком, можно ли списать деньги: достаточно ли средств, валидна ли карта, нет ли блокировок. Деньги ещё не списаны окончательно.",
    link: "https://en.wikipedia.org/wiki/Authorization_hold",
  },
  capture: {
    title: "Capture (окончательное списание)",
    text:
      "Финальное списание средств после авторизации. Иногда объединяется с авторизацией в один шаг.",
    link: "https://stripe.com/docs/payments/capture-later",
  },
  token: {
    title: "Токенизация",
    text:
      "Заменяем реквизиты карты на безопасный токен, чтобы не хранить PAN.",
    link: "https://en.wikipedia.org/wiki/Tokenization_(data_security)",
  },
  ds3: {
    title: "3-D Secure",
    text:
      "Дополнительное подтверждение у банка (СМС/Push/FaceID), чтобы убедиться, что платит владелец.",
    link: "https://ru.wikipedia.org/wiki/3-D_Secure",
  },
  risk: {
    title: "Проверка риска",
    text:
      "Автоматические проверки (гео, частота, устройство, списки), чтобы отсеивать подозрительные операции.",
    link: "https://en.wikipedia.org/wiki/Fraud_detection",
  },
};

function Term({ k, label }) {
  const [open, setOpen] = useState(false);
  const item = GLOSSARY[k];
  if (!item) return <>{label}</>;
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="underline decoration-dotted underline-offset-4 text-sky-300 hover:text-sky-200 cursor-help relative"
    >
      {label}
      {open && (
        <div className="absolute z-30 mt-2 max-w-[320px] rounded-xl border border-[#1B3B66] bg-[#0F1B2B] p-3 text-left shadow-[0_10px_30px_rgba(0,0,0,.5)]">
          <div className="font-semibold text-[#39BDF8] mb-1">{item.title}</div>
          <div className="text-sm text-[#E6F3FF] leading-relaxed">{item.text}</div>
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer" className="text-xs text-[#8FD9FF] underline">
              Подробнее
            </a>
          )}
        </div>
      )}
    </button>
  );
}

// Преобразуем [[key|метка]] в интерактивные <Term/>
function renderWithTerms(str) {
  const parts = [];
  const regex = /\[\[(\w+)\|([^\]]+)\]\]/g;
  let last = 0, m;
  while ((m = regex.exec(str)) !== null) {
    if (m.index > last) parts.push(str.slice(last, m.index));
    parts.push(<Term key={`t-${m.index}`} k={m[1]} label={m[2]} />);
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push(str.slice(last));
  return parts;
}

// -------------------
// Состояния и машина
// -------------------
const Steps = {
  CART: "CART",
  PAYMENT: "PAYMENT",
  AUTH: "AUTH",
  PROCESSING: "PROCESSING",
  RESULT: "RESULT",
};

const ResultKinds = { SUCCESS: "SUCCESS", FAIL: "FAIL" };
const nowHHMMSS = () => new Date().toLocaleTimeString();

// ----------------
// Главный экран
// ----------------
export default function App() {
  const [step, setStep] = useState(Steps.CART);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);

  // Флаги альтернативных сценариев
  const [require3DS, setRequire3DS] = useState(true);
  const [force3DSFail, setForce3DSFail] = useState(false);
  const [simulateTimeout, setSimulateTimeout] = useState(false);
  const [declineAtAcquirer, setDeclineAtAcquirer] = useState(false);

  const [method, setMethod] = useState("card_saved");

  const reset = () => {
    setStep(Steps.CART);
    setResult(null);
    setLog([]);
  };

  const pushLog = (msg) => setLog((l) => [{ t: nowHHMMSS(), msg }, ...l]);

  // --------------------------
  // Переходы между шагами
  // --------------------------

  // Шаг 1 → Шаг 2: пользователь жмёт «Оформить заказ»
  // Важно: мы делаем запрос с идемпотентным ключом, чтобы два клика не создали два платежа.
  const goPayment = () => {
    pushLog(
      "Мы проверили корзину и зафиксировали сумму к оплате. Запрос защищён [[idem|идемпотентным ключом]], чтобы случайные повторы не создали лишние платежи. Через [[bff|BFF]] идём к внутренним сервисам."
    );
    setStep(Steps.PAYMENT);
  };

  // Шаг 2: пользователь выбирает метод и жмёт «Оплатить»
  // Создаём черновик заказа и Payment Intent, запускаем антифрод.
  const startPayment = () => {
    pushLog(
      "Создаём черновик заказа со статусом «Ожидает оплаты» и запускаем [[risk|проверку риска]]. Затем готовим [[intent|намерение платежа]] для выбранного метода."
    );
    if (require3DS) {
      pushLog("Банк может попросить подтвердить платёж — запустим [[ds3|3-D Secure]].");
      setStep(Steps.AUTH);
    } else {
      authorize();
    }
  };

  // «Сердце» процесса: обращение к PSP и банку, 3DS при необходимости, затем capture и вебхук.
  const authorize = () => {
    // Авторизация: банк проверяет карту и доступность средств.
    pushLog(
      "Отправляем запрос на [[auth|авторизацию]] в [[psp|платёжного провайдера]]. Банк проверяет карту и доступность средств."
    );

    // Вариант отказа на стороне банка (например, недостаточно средств).
    if (declineAtAcquirer) {
      pushLog("Банк отказал в авторизации. Частые причины: недостаточно средств, лимиты карты или подозрение на мошенничество.");
      setResult(ResultKinds.FAIL);
      setStep(Steps.RESULT);
      return;
    }

    // 3-D Secure при необходимости: подтверждение у банка.
    if (require3DS) {
      pushLog("Запрашиваем подтверждение у банка через [[ds3|3-D Secure]].");
      if (force3DSFail) {
        pushLog("Подтверждение не прошло — пользователь не подтвердил операцию или банк отклонил её.");
        setResult(ResultKinds.FAIL);
        setStep(Steps.RESULT);
        return;
      } else {
        pushLog("Подтверждение прошло успешно.");
      }
    }

    // Успех авторизации → ждём финальное списание (capture) и вебхук.
    pushLog("Авторизация одобрена. Ожидаем окончательное списание ([[capture|capture]]).");
    setStep(Steps.PROCESSING);

    // Если пользователь закрыл вкладку/произошла задержка — вебхук всё равно дойдёт и мы узнаем результат.
    if (simulateTimeout) {
      pushLog("На стороне клиента произошла задержка/перезагрузка. Это не страшно — ждём сигнал от провайдера через [[webhook|вебхук]].");
    }

    // Симулируем приход вебхука с результатом списания:
    setTimeout(() => {
      if (result === ResultKinds.FAIL) return;
      pushLog("Получили [[webhook|вебхук]]: средства списаны ([[capture|capture]]).");
      pushLog("Отмечаем заказ как оплаченный и отправляем квитанцию на e-mail.");
      setResult(ResultKinds.SUCCESS);
      setStep(Steps.RESULT);
    }, simulateTimeout ? 2200 : 1200);
  };

  const continueAuth = () => authorize();

  const stepTitle = {
    [Steps.CART]: "Корзина и проверка суммы",
    [Steps.PAYMENT]: "Выбор способа оплаты и запуск платежа",
    [Steps.AUTH]: "Аутентификация 3-D Secure",
    [Steps.PROCESSING]: "Обработка и ожидание вебхука",
    [Steps.RESULT]: result === ResultKinds.SUCCESS ? "Платёж подтверждён" : "Оплата не прошла",
  }[step];

  // -------------
  // Разметка UI
  // -------------
  return (
    <div className="min-h-screen bg-[#0A1626] text-[#E6F3FF]">
      {/* Шапка с «фирменным» градиентом */}
      <div className="bg-gradient-to-r from-[#0B6FE4] via-[#0A8DFF] to-[#00AEEF]">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-sm bg-white/10 grid place-content-center shadow-inner">
              <span className="text-xs font-black text-white">XB</span>
            </div>
            <span className="font-extrabold tracking-wider uppercase text-white">Checkout Simulator</span>
          </div>
          <div className="text-xs text-white/90">Demo • Book purchase</div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Симулятор оформления покупки книги</h1>
            <p className="text-[#A7D3FF] text-sm">
              Сценарий: вы — давний пользователь, книга уже в корзине. Покажем путь от «Оформить» до подтверждения платежа
              и что происходит за кулисами.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={reset}>Сброс</Button>
            <Button variant="outline" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>
              Вниз к логам
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* LEFT: сам симулятор */}
          <section className="col-span-12 lg:col-span-8">
            <div className="rounded-2xl border border-[#123763] bg-[#0F1B2B]/70 p-4 shadow-[0_0_0_1px_#0B6FE4,0_0_30px_rgba(11,111,228,.20)]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#8FD9FF]/80">Текущий шаг</div>
                  <div className="text-lg font-semibold">{stepTitle}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone="info">Idem-Key</Chip>
                  <Chip tone="info">Webhooks</Chip>
                  {require3DS && <Chip tone="warn">3-D Secure</Chip>}
                </div>
              </div>

              {/* Рамка телефона */}
              <div className="mx-auto w-full max-w-[420px] rounded-[28px] border border-[#123763] bg-[#0B1020] p-3 shadow-[0_0_0_1px_#123763,0_0_24px_rgba(18,55,99,.35)]">
                <div className="mx-auto h-[24px] w-32 rounded-b-2xl bg-[#11233b]" />
                <div className="mt-2 rounded-2xl border border-[#123763] bg-[#0F1B2B] p-4 min-h-[520px]">
                  {step === Steps.CART && <CartStep onNext={goPayment} />}
                  {step === Steps.PAYMENT && <PaymentStep method={method} setMethod={setMethod} onPay={startPayment} />}
                  {step === Steps.AUTH && <AuthStep onContinue={continueAuth} forceFail={force3DSFail} />}
                  {step === Steps.PROCESSING && <ProcessingStep />}
                  {step === Steps.RESULT && <ResultStep kind={result} onReset={reset} />}
                </div>
              </div>

              {/* Короткие пояснения по шагам */}
              <div className="mt-4 flex flex-wrap gap-2">
                {step === Steps.CART && (
                  <Explain title="Что сейчас делает система">
                    Frontend вызывает [[bff|BFF]] с [[idem|идемпотентным ключом]], сервис корзины пересчитывает сумму (промо/налоги),
                    готовится черновой заказ.
                  </Explain>
                )}
                {step === Steps.PAYMENT && (
                  <Explain title="Что происходит при нажатии «Оплатить»">
                    Создаём заказ (Pending), запускаем [[risk|проверку риска]]. Оркестратор формирует [[intent|намерение платежа]]
                    и делает [[token|токенизацию]].
                  </Explain>
                )}
                {step === Steps.AUTH && (
                  <Explain title="3-D Secure">
                    В зависимости от политики банка — frictionless (в фоне) или challenge (подтверждение пользователем).
                    Реквизиты карты нам не видны — только токены.
                  </Explain>
                )}
                {step === Steps.PROCESSING && (
                  <Explain title="Почему экран ждёт вебхук">
                    Источник истины — [[webhook|вебхуки]] от [[psp|провайдера]]. Клиент может перезагрузиться, но как только вебхук придёт —
                    заказ финализируется и UI подтянет статус.
                  </Explain>
                )}
                {step === Steps.RESULT && (
                  <Explain title="Финализация заказа">
                    По успешному вебхуку отмечаем заказ как Paid, закрываем платёж и отправляем квитанцию. BI получает событие для отчётности.
                  </Explain>
                )}
              </div>
            </div>

            {/* Переключатели альтернатив */}
            <div className="mt-4 rounded-2xl border border-[#123763] bg-[#0F1B2B]/70 p-4">
              <h3 className="mb-2 text-base font-semibold">Альтернативные сценарии</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Switch checked={require3DS} onChange={setRequire3DS} label="Требуется 3-D Secure" />
                <Switch checked={force3DSFail} onChange={setForce3DSFail} label="Неудача 3-D Secure (challenge fail)" />
                <Switch checked={declineAtAcquirer} onChange={setDeclineAtAcquirer} label="Отказ банка на авторизации (decline)" />
                <Switch checked={simulateTimeout} onChange={setSimulateTimeout} label="Таймаут клиента (ожидание вебхука)" />
              </div>
              <p className="mt-2 text-sm text-[#A7D3FF]">
                Включайте флаги и проходите поток заново — увидите разные исходы и события в логе.
              </p>
            </div>
          </section>

          {/* RIGHT: лог и краткая справка */}
          <aside className="col-span-12 lg:col-span-4">
            <div className="sticky top-4 flex flex-col gap-4">
              <div className="rounded-2xl border border-[#123763] bg-[#0F1B2B]/70 p-4">
                <h3 className="mb-2 text-base font-semibold">События и интеграции</h3>
                <ul className="space-y-2 text-sm text-[#CFE8FF]">
                  <li>• Frontend ↔ [[bff|BFF]] — REST/GraphQL (идемпотентность)</li>
                  <li>• BFF ↔ Order/Risk/Orchestrator — синхронные вызовы</li>
                  <li>• Orchestrator ↔ [[psp|PSP]] — API + [[ds3|3-D Secure]]</li>
                  <li>• [[psp|PSP]] → [[webhook|Webhooks]] → Order/Orchestrator — статусы</li>
                  <li>• Order → Notifications/BI — события «Paid/Failed»</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#123763] bg-[#0F1B2B]/70 p-4">
                <h3 className="mb-2 text-base font-semibold">Лог действий</h3>
                <div className="h-80 overflow-auto rounded-xl border border-[#123763] bg-[#0B1020] p-2 text-sm">
                  {log.length === 0 ? (
                    <div className="p-2 text-[#8FD9FF]/70">Здесь появятся понятные, «человеческие» события.</div>
                  ) : (
                    <ul className="space-y-2">
                      {log.map((e, i) => (
                        <li key={i} className="whitespace-pre-wrap leading-relaxed">
                          <span className="text-[#8FD9FF]/60">[{e.t}] </span>
                          {renderWithTerms(e.msg)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-2 text-xs text-[#A7D3FF]">
                  Подсказка: синие подчёркнутые термины кликабельны — нажмите, чтобы увидеть объяснение.
                </div>
              </div>

              <div className="rounded-2xl border border-[#123763] bg-[#0F1B2B]/70 p-4">
                <h3 className="mb-2 text-base font-semibold">Полезные ссылки</h3>
                <ul className="list-disc pl-5 text-sm text-[#CFE8FF] space-y-1">
                  <li><a className="underline" href="https://ru.wikipedia.org/wiki/3-D_Secure" target="_blank" rel="noreferrer">3-D Secure</a></li>
                  <li><a className="underline" href="https://ru.wikipedia.org/wiki/Webhook" target="_blank" rel="noreferrer">Webhooks (Вебхуки)</a></li>
                  <li><a className="underline" href="https://stripe.com/docs/payments/payment-intents" target="_blank" rel="noreferrer">Payment Intent</a></li>
                  <li><a className="underline" href="https://en.wikipedia.org/wiki/Authorization_hold" target="_blank" rel="noreferrer">Authorization Hold</a></li>
                  <li><a className="underline" href="https://stripe.com/docs/payments/capture-later" target="_blank" rel="noreferrer">Capture</a></li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ---------------------------
// Компоненты шагов процесса
// ---------------------------

function Explain({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <Badge
        className="border-[#39BDF8] text-[#8FD9FF] hover:bg-[#0F1B2B] cursor-pointer"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        ✳︎ Explain
      </Badge>
      {open && (
        <div className="absolute z-20 mt-2 w-[340px] max-w-[86vw] rounded-xl border border-[#1B3B66] bg-[#0F1B2B] p-3 text-sm text-[#E6F3FF] shadow-[0_10px_30px_rgba(0,0,0,.5)]">
          <div className="font-semibold text-[#39BDF8] mb-1">{title}</div>
          <div className="leading-relaxed">{renderWithTerms(typeof children === "string" ? children : String(children))}</div>
        </div>
      )}
    </span>
  );
}

function CartStep({ onNext }) {
  // Этап: пользователь подтверждает корзину, видит итоговую сумму.
  // Бизнес: проверка доступности товара, скидок, стоимости доставки.
  // Системно: запрос в BFF с idem-key, фиксация суммы и подготовка черновика заказа.
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-[#CFE8FF]">Ваша корзина</div>
        <Chip tone="ok">Авторизован</Chip>
      </div>
      <div className="flex-1 space-y-3">
        <div className="rounded-xl border border-[#123763] bg-[#11233b] p-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-10 flex-none rounded bg-[#163A6B]" />
            <div className="flex-1">
              <div className="font-medium">«Секреты архитектуры платежей»</div>
              <div className="text-xs text-[#8FD9FF]/70">Бумажная, 352 стр. · ISBN 978-1-23456-789-7</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">1 299 ₽</div>
              <div className="text-xs text-[#34D399]">Промо −200 ₽</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-[#123763] bg-[#11233b] p-3">Доставка: <b>0 ₽</b> (эльфы)</div>
          <div className="rounded-xl border border-[#123763] bg-[#11233b] p-3">Налог: <b>включён</b></div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm">Итого: <span className="text-lg font-semibold">1 099 ₽</span></div>
        <Button onClick={onNext}>Оформить заказ</Button>
      </div>
    </div>
  );
}

function PaymentStep({ method, setMethod, onPay }) {
  // Этап: выбор способа оплаты и запуск платёжного процесса.
  // Бизнес: минимальное трение — показываем сохранённые карты, кошельки.
  // Системно: создаём Order(Pending), запускаем Risk, формируем Payment Intent.
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 text-sm text-[#CFE8FF]">Оплата заказа #ORD-12345</div>
      <div className="space-y-3">
        <div className="rounded-xl border border-[#123763] bg-[#11233b] p-3">
          <div className="mb-1 text-sm text-[#CFE8FF]">Способ оплаты</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="pm" checked={method === "card_saved"} onChange={() => setMethod("card_saved")} />
              <span>Сохранённая карта •• 4242</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pm" checked={method === "apple"} onChange={() => setMethod("apple")} />
              <span>Apple Pay</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pm" checked={method === "wallet"} onChange={() => setMethod("wallet")} />
              <span>Электронный кошелёк</span>
            </label>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#A7D3FF]">
          <input type="checkbox" defaultChecked /> Я согласен с условиями оферты
        </label>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <div className="text-sm text-[#A7D3FF]">Итого к оплате: <b className="text-[#E6F3FF]">1 099 ₽</b></div>
        <Button onClick={onPay}>Оплатить</Button>
      </div>
    </div>
  );
}

function AuthStep({ onContinue, forceFail }) {
  // Этап: подтверждение владельца (3-D Secure).
  // Бизнес: безопасность > удобство; иногда банк не требует явного подтверждения (frictionless).
  // Системно: мы не видим PAN, взаимодействуем с 3DS через провайдера/SDK.
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-2 text-sm text-[#CFE8FF]">3-D Secure (банк подтверждает плательщика)</div>
      <div className="mx-auto mb-3 h-24 w-24 rounded-full border-4 border-[#123763] grid place-content-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[#39BDF8]" />
      </div>
      <div className="text-xs text-[#A7D3FF] mb-4">
        {forceFail ? "Имитация: пользователь не прошёл challenge" : "Имитация: подтверждение FaceID/в приложении банка"}
      </div>
      <div className="flex gap-2">
        <Button variant="success" onClick={onContinue} disabled={forceFail}>Продолжить</Button>
        <Button variant="danger" onClick={onContinue} disabled={!forceFail}>Завершить с ошибкой</Button>
      </div>
    </div>
  );
}

function ProcessingStep() {
  // Этап: «сердце» платёжной асинхронщины — UI ждёт вебхук.
  // Бизнес: важно показать «мы работаем» и объяснить пользователю, что статус подтянется.
  // Системно: источник истины — входящие вебхуки с подписью; UI может быть перезагружен.
  return (
    <div className="grid h-full place-content-center text-center">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#123763] border-t-[#0B6FE4]" />
      <div className="text-sm">Обрабатываем платёж… ждём подтверждение от банка</div>
      <div className="mt-1 text-xs text-[#A7D3FF]">Окно можно закрыть — статус подтянется по вебхуку.</div>
    </div>
  );
}

function ResultStep({ kind, onReset }) {
  // Финальный экран: успешный платёж или отказ.
  // Бизнес: предложить следующее действие (скачать чек, вернуться, выбрать другой метод).
  // Системно: все статусы должны быть синхронизированы с Order по факту вебхука.
  if (kind === ResultKinds.SUCCESS) {
    return (
      <div className="grid h-full place-content-center text-center">
        <div className="mx-auto mb-3 h-14 w-14 grid place-content-center rounded-full bg-emerald-500/10 text-emerald-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div className="text-lg font-semibold text-[#7EE7C4]">Платёж подтверждён</div>
        <div className="text-sm text-[#CFE8FF]">Заказ #ORD-12345 оплачен. Квитанция отправлена на почту.</div>
        <div className="mt-4"><Button variant="ghost" onClick={onReset}>Вернуться к началу</Button></div>
      </div>
    );
  }
  return (
    <div className="grid h-full place-content-center text-center">
      <div className="mx-auto mb-3 h-14 w-14 grid place-content-center rounded-full bg-rose-500/10 text-rose-400">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </div>
      <div className="text-lg font-semibold text-[#FFB3B3]">Оплата не прошла</div>
      <div className="text-sm text-[#CFE8FF]">Попробуйте другой метод (Apple Pay/другая карта) или повторите позже.</div>
      <div className="mt-4"><Button variant="ghost" onClick={onReset}>Попробовать ещё раз</Button></div>
    </div>
  );
}
