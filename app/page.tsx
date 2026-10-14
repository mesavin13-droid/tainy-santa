'use client';
import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Gift, Heart, LockKeyhole, Snowflake, Sparkles, Users, CalendarDays, Menu, X } from 'lucide-react';

type Game = { name: string; company: string; budget: string; date: string; deadline: string; rules: string };
const initialGame: Game = { name: 'Тайный Санта 2027', company: 'Наша компания', budget: '1500', date: '2027-12-25', deadline: '2027-12-10', rules: 'Дарим подарки в пределах бюджета. Главное — внимание и немного волшебства.' };

export default function Home() {
  const [game, setGame] = useState<Game>(initialGame);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [introStage, setIntroStage] = useState<'locked' | 'newyear' | 'done'>('locked');
  const [giftOpening, setGiftOpening] = useState(false);
  const unlock = () => {
    if (giftOpening) return;
    setGiftOpening(true);
    window.setTimeout(() => setIntroStage('newyear'), 950);
  };
  const finishIntro = () => setIntroStage('done');
  const update = (key: keyof Game, value: string) => setGame(prev => ({ ...prev, [key]: value }));

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setCreating(true); setCreateError('');
    try {
      const response = await fetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: game.name, company_name: game.company, budget: game.budget, exchange_date: game.date, registration_deadline: game.deadline, rules: game.rules }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось создать игру.');
      localStorage.setItem(`santa:organizer:${data.game.slug}`, data.organizerToken);
      window.location.assign(`/g/${data.game.slug}#o=${data.organizerToken}`);
    } catch (error) { setCreateError(error instanceof Error ? error.message : 'Не удалось создать игру.'); }
    finally { setCreating(false); }
  };
  const openGameByCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = gameCode.trim();
    const pathMatch = value.match(/\/g\/([^/?#]+)/i);
    if (pathMatch) {
      const personalFragment = value.match(/#([po]=[A-Za-z0-9_-]+)$/)?.[1];
      window.location.assign(`/g/${encodeURIComponent(pathMatch[1])}${personalFragment ? `#${personalFragment}` : ''}`);
      return;
    }
    const code = value.replace(/.*\//, '').split(/[?#]/)[0];
    if (code) window.location.assign(`/g/${encodeURIComponent(code)}`);
  };

  return <main>
    {introStage !== 'done' && <div className={introStage === 'locked' ? 'santa-intro santa-lock-screen' : 'santa-intro santa-newyear-screen'} role="dialog" aria-modal="true" aria-label={introStage === 'locked' ? 'Разблокировка Тайного Санты' : 'Поздравление с Новым годом'}>
      <div className="intro-stars" aria-hidden="true">{Array.from({length: 24}, (_, i) => <i key={i} style={{'--i': i} as React.CSSProperties}>✦</i>)}</div>
      {introStage === 'locked' ? <>
        <div className="intro-status"><LockKeyhole size={15}/> ТАЙНЫЙ САНТА <span>2027</span></div>
        <div className="lock-content welcome-content">
          <div className="lock-date">Скоро Новый год</div>
          <h1 className="welcome-title">Мы хотим сделать<br/><em>маленькое чудо</em></h1>
          <p className="welcome-message">Давайте подарим друг другу немного волшебства! Тайный Санта — это сюрпризы, тёплые пожелания и радость от того, что кто-то готовит подарок именно для тебя.</p>
          <button type="button" className={`gift-open-trigger${giftOpening ? " is-opening" : ""}`} onClick={unlock} disabled={giftOpening} aria-label="Открыть новогодний подарок">
            <span className="gift-open-label">Открыть</span>
            <svg className="gift-dotted-arrow" viewBox="0 0 92 52" aria-hidden="true"><path d="M4 8 C31 3 39 20 53 29 S73 40 80 30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 6"/><path d="M69 29 L80 30 L78 19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div className="lock-gift" aria-hidden="true">
              <img className="lock-gift-render" src="/secret-santa-winter-scene.svg" alt="Дед Мороз, снеговик и новогодняя ёлка" />
            </div>
          </button>
        </div>
        <div className="gift-open-caption">{giftOpening ? "Уже открываем твоё чудо…" : "Нажми на подарок"}</div>
      </> : <>
        <div className="intro-status"><Sparkles size={15}/> С НОВЫМ ГОДОМ <span>2027</span></div>
        <div className="newyear-content">
          <div className="newyear-kicker">Пусть сбудется всё хорошее</div>
          <div className="newyear-number">2027</div>
          <img className="newyear-winter-scene" src="/secret-santa-winter-scene.svg" alt="" aria-hidden="true" />
          <h1>С наступающим<br/><em>Новым годом!</em></h1>
          <p className="newyear-message">Пусть в новом году будет больше поводов улыбаться, тёплых встреч, неожиданных подарков и маленьких чудес.</p>
          <p className="newyear-thanks">Спасибо, что играете с нами <Heart size={14} fill="currentColor" aria-hidden="true" /></p>
          <div className="wish-chips"><span><Sparkles size={13} aria-hidden="true" /> Счастья</span><span><Gift size={13} aria-hidden="true" /> Чудес</span><span><Heart size={13} aria-hidden="true" /> Тепла</span></div>
          <button className="newyear-enter" onClick={finishIntro}>Войти в игру <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="newyear-bottom">Пусть желания сбываются</div>
        <div className="confetti" aria-hidden="true">{Array.from({length: 38}, (_, i) => <i key={i} style={{'--i': i} as React.CSSProperties}/>)}</div>
      </>}
    </div>}
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Snowflake size={19}/></span><span>ТАЙНЫЙ САНТА</span></a><nav className={mobileMenu ? 'nav nav-open' : 'nav'}><a href="#how" onClick={() => setMobileMenu(false)}>Как это работает</a><a href="#rules" onClick={() => setMobileMenu(false)}>Правила</a><button className="button button-small button-outline" onClick={() => setShowCreate(true)}>Создать игру <ArrowRight size={15}/></button></nav><button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Открыть меню">{mobileMenu ? <X/> : <Menu/>}</button></header>
    <section className="hero" id="top"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> КОРПОРАТИВНАЯ ТРАДИЦИЯ</div><h1>Подарки —<br/><em>тайна.</em> Радость —<br/>общая.</h1><p className="hero-text">Организуйте Тайного Санту в компании за несколько минут. Сотрудники подключаются по ссылке, а кому дарить — узнают только они.</p><div className="hero-actions"><button className="button button-gold" onClick={() => setShowCreate(true)}>Создать игру <ArrowRight size={17}/></button><button className="button button-ghost" onClick={() => setShowJoin(true)}>У меня есть код</button></div><div className="hero-notes"><span><Check size={15}/> Без установки приложения</span><span><LockKeyhole size={15}/> Тайные назначения</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="star star-a">✳</div><div className="star star-b">✦</div><div className="star star-c">·</div><div className="gift-stage"><img className="gift-render" src="/secret-santa-gift.svg" alt="" aria-hidden="true" /></div><div className="art-label"><span className="pulse-dot"/> ВРЕМЯ ДАРИТЬ ЧУДО</div><div className="art-caption">Секрет уже<br/>в пути.</div></div></section>
    <section className="game-strip"><div><span className="strip-label">ПРИМЕР ИГРЫ</span><h2>{game.name}</h2><p>{game.company}</p></div><div className="strip-stat"><CalendarDays size={18}/><div><span>День обмена</span><strong>{game.date ? new Date(game.date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}) : 'Уточняется'}</strong></div></div><div className="strip-stat"><Gift size={18}/><div><span>Бюджет подарка</span><strong>{Number(game.budget || 0).toLocaleString('ru-RU')} ₽</strong></div></div><button className="button button-dark" onClick={() => setShowJoin(true)}>Присоединиться <ArrowRight size={16}/></button></section>
    <section className="section how" id="how"><div className="section-heading"><div className="eyebrow">НИКАКОЙ СУЕТЫ</div><h2>Три шага.<br/><em>Одна большая тайна.</em></h2><p>Всё просто: даже если вы играете впервые.</p></div><div className="steps"><article className="step-card"><div className="step-top"><span>01 / СОЗДАЙ</span><Users size={21}/></div><div className="step-icon icon-green"><Users size={27}/></div><h3>Собери команду</h3><p>Организатор задаёт бюджет и дату. Ссылка и QR-код готовы — осталось отправить коллегам.</p><div className="step-line"/></article><article className="step-card"><div className="step-top"><span>02 / ЖЕРЕБЬЁВКА</span><Sparkles size={21}/></div><div className="step-icon icon-gold"><Gift size={27}/></div><h3>Узнай свою тайну</h3><p>Каждый получает одного адресата. Никто не дарит самому себе и не видит чужих назначений.</p><div className="step-line"/></article><article className="step-card"><div className="step-top"><span>03 / ПОДАРИ</span><Snowflake size={21}/></div><div className="step-icon icon-red"><LockKeyhole size={27}/></div><h3>Сохрани интригу</h3><p>Подсмотри пожелания, задай анонимный вопрос и раскрой себя только тогда, когда захочешь.</p><div className="step-line"/></article></div></section>
    <section className="secret-section" id="rules"><div className="secret-art"><div className="moon">✦</div><div className="envelope"><div className="envelope-back"/><div className="envelope-paper"><Snowflake size={24}/><span>ТВОЯ ТАЙНА</span></div><div className="envelope-flap"/><div className="seal">S</div></div><span className="secret-spark spark-one">✦</span><span className="secret-spark spark-two">✳</span></div><div className="secret-copy"><div className="eyebrow">СЕКРЕТНОСТЬ — НЕ ДЕКОРАЦИЯ</div><h2>Твоя тайна.<br/><em>Только твоя.</em></h2><p>После жеребьёвки ты увидишь только своего получателя. Остальные назначения закрыты — в том числе от других участников.</p><ul><li><Check size={17}/> Личные ссылки вместо сложной регистрации</li><li><Check size={17}/> Пожелания, которые помогают выбрать подарок</li><li><Check size={17}/> Анонимные вопросы без раскрытия личности</li><li><Check size={17}/> Никаких назначений самому себе</li></ul><button className="button button-gold" onClick={() => setShowCreate(true)}>Организовать игру <ArrowRight size={16}/></button></div></section>
    <section className="final-cta"><div className="eyebrow"><Sparkles size={14}/> ПУСТЬ НАЧНЁТСЯ ВОЛШЕБСТВО</div><h2>Лучшие подарки —<br/><em>те, которых не ждёшь.</em></h2><button className="button button-gold" onClick={() => setShowCreate(true)}>Создать Тайного Санту <ArrowRight size={17}/></button><p>Бесплатный старт. Без приложения. Только ваша команда.</p></section>
    <footer><a className="brand" href="#top"><span className="brand-mark"><Snowflake size={17}/></span><span>ТАЙНЫЙ САНТА</span></a><span>Сделано для маленьких чудес.</span><a href="#rules">Правила игры <ChevronDown size={14}/></a></footer>
    {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><section className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setShowCreate(false)} aria-label="Закрыть"><X/></button><div className="eyebrow">НАЧИНАЕМ ВОЛШЕБСТВО</div><h2>Создай свою игру</h2><p className="modal-intro">Пара деталей — и можно приглашать коллег.</p><form onSubmit={handleCreate}><label>Название игры<input value={game.name} onChange={e => update('name',e.target.value)} required/></label><label>Компания<input value={game.company} onChange={e => update('company',e.target.value)} required/></label><div className="form-grid"><label>Бюджет, ₽<input type="number" min="1" value={game.budget} onChange={e => update('budget',e.target.value)} required/></label><label>День вручения<input type="date" value={game.date} onChange={e => update('date',e.target.value)} required/></label></div><label>Регистрация до<input type="date" value={game.deadline} onChange={e => update('deadline',e.target.value)} required/></label><label>Правила и пожелания<textarea rows={3} value={game.rules} onChange={e => update('rules',e.target.value)}/></label><button className="button button-gold button-full" type="submit" disabled={creating}>{creating ? 'Создаём игру…' : 'Создать игру'} <ArrowRight size={16}/></button>{createError && <p className="form-note" role="alert">{createError}</p>}<p className="form-note">После создания появится ссылка для команды и панель организатора.</p></form></section></div>}
    {showJoin && <div className="modal-backdrop" onClick={() => setShowJoin(false)}><section className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setShowJoin(false)} aria-label="Закрыть"><X/></button><div className="eyebrow">ТВОЯ КОМАНДА ЖДЁТ</div><h2>Открыть игру</h2><p className="modal-intro">Вставь код игры или ссылку из приглашения. Имя и пожелания добавишь уже внутри.</p><form onSubmit={openGameByCode}><label>Код игры или ссылка<input value={gameCode} onChange={e => setGameCode(e.target.value)} placeholder="Например, a81bc92f… или ссылка" required maxLength={300}/></label><button className="button button-gold button-full" type="submit">Продолжить <ArrowRight size={16}/></button></form><p className="form-note">Если тебе прислали персональную ссылку, просто открой её — код вводить не нужно.</p></section></div>}
  </main>;
}