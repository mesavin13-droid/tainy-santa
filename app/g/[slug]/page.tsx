'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Copy, Gift, LockKeyhole, RefreshCw, Send, ShieldCheck, Sparkles, Users, Video, X } from 'lucide-react';

type Game = { id?: string; slug: string; name: string; company_name: string; budget: number; exchange_date: string; registration_deadline: string; rules: string; status: 'registration' | 'drawn' | 'completed' };
type Person = { id: string; display_name: string; department?: string; wishlist?: string; gift_state?: 'pending' | 'prepared' | 'delivered'; created_at?: string };
type Restriction = { id?: string; giver_id: string; receiver_id: string };
type MeData = { game: Game; participant: Person & { revealed_at?: string | null }; recipient: Person | null; inbox: { id: string; body: string; created_at: string }[]; outbox: { id: string; body: string; created_at: string; answer?: string | null }[]; revealedSenders: string[]; receivedVideoGreetings: { id: string; url: string; sender_label: string; created_at: string }[]; myVideoGreeting: { id: string; uploaded_at: string | null } | null };
type Notice = { type: 'error' | 'success'; text: string };

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос.');
  return data;
}

export default function GamePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [game, setGame] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<Person[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [me, setMe] = useState<MeData | null>(null);
  const [organizerToken, setOrganizerToken] = useState('');
  const [participantToken, setParticipantToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [wishlist, setWishlist] = useState('');
  const [message, setMessage] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [giverId, setGiverId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [copied, setCopied] = useState(false);

  const gameUrl = typeof window !== 'undefined' ? window.location.origin + '/g/' + slug : '';
  const isOrganizer = Boolean(organizerToken);
  const isParticipant = Boolean(participantToken && me);
  const refreshPublic = useCallback(async () => {
    const data = await readJson(await fetch('/api/games/' + encodeURIComponent(slug), { cache: 'no-store' }));
    setGame(data.game);
    setParticipants(data.recentParticipants || []);
  }, [slug]);
  const refreshAdmin = useCallback(async (token: string) => {
    const data = await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/admin', { headers: { 'x-organizer-token': token }, cache: 'no-store' }));
    setGame(data.game);
    setParticipants(data.participants || []);
    setRestrictions(data.restrictions || []);
  }, [slug]);
  const refreshMe = useCallback(async (token: string) => {
    const data = await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), cache: 'no-store' }));
    setMe(data);
    setGame(data.game);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const fragment = window.location.hash.slice(1);
        const fragmentParams = new URLSearchParams(fragment);
        const organizerFromUrl = fragmentParams.get('o') || localStorage.getItem('santa:organizer:' + slug) || '';
        const participantFromUrl = fragmentParams.get('p') || localStorage.getItem('santa:participant:' + slug) || '';
        if (organizerFromUrl) {
          localStorage.setItem('santa:organizer:' + slug, organizerFromUrl);
          if (!cancelled) setOrganizerToken(organizerFromUrl);
          await refreshAdmin(organizerFromUrl);
        } else if (participantFromUrl) {
          localStorage.setItem('santa:participant:' + slug, participantFromUrl);
          if (!cancelled) setParticipantToken(participantFromUrl);
          await refreshPublic();
          await refreshMe(participantFromUrl);
        } else {
          await refreshPublic();
        }
      } catch (error) {
        if (!cancelled) setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось загрузить игру.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void init();
    return () => { cancelled = true; };
  }, [slug, refreshPublic, refreshAdmin, refreshMe]);

  useEffect(() => {
    if (!game || (isOrganizer && !organizerToken)) return;
    const timer = window.setInterval(() => {
      if (organizerToken) void refreshAdmin(organizerToken).catch(() => {});
      else void refreshPublic().catch(() => {});
    }, 12000);
    return () => window.clearInterval(timer);
  }, [game, organizerToken, isOrganizer, refreshAdmin, refreshPublic]);

  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase('ru-RU') || '').join('');
  const notifyError = (error: unknown) => setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Что-то пошло не так.' });
  const joinGame = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const data = await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: displayName, department, wishlist }) }));
      localStorage.setItem('santa:participant:' + slug, data.participantToken);
      setParticipantToken(data.participantToken);
      window.history.replaceState(null, '', '/g/' + slug + '#p=' + data.participantToken);
      await refreshMe(data.participantToken);
      setShowJoin(false);
      setNotice({ type: 'success', text: 'Вы присоединились к игре. Сохраните личную ссылку — она понадобится позже.' });
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  const draw = async () => {
    if (!organizerToken || !window.confirm('Провести жеребьёвку? После этого состав участников и ограничения нельзя будет изменить.')) return;
    setBusy(true); setNotice(null);
    try {
      await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/draw', { method: 'POST', headers: { 'x-organizer-token': organizerToken } }));
      await refreshAdmin(organizerToken);
      setNotice({ type: 'success', text: 'Жеребьёвка проведена. Назначения сохранены.' });
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  const saveRestriction = async (action: 'add' | 'remove', restriction?: Restriction) => {
    const giver = restriction?.giver_id || giverId;
    const receiver = restriction?.receiver_id || receiverId;
    setBusy(true); setNotice(null);
    try {
      await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/restrictions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organizer-token': organizerToken }, body: JSON.stringify({ action, giver_id: giver, receiver_id: receiver }) }));
      await refreshAdmin(organizerToken);
      setGiverId(''); setReceiverId('');
      setNotice({ type: 'success', text: action === 'add' ? 'Ограничение добавлено.' : 'Ограничение удалено.' });
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  const saveMe = async (patch: Record<string, unknown>) => {
    if (!participantToken) return;
    setBusy(true); setNotice(null);
    try {
      await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: participantToken, ...patch }) }));
      await refreshMe(participantToken);
      setNotice({ type: 'success', text: 'Изменения сохранены.' });
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!participantToken || !message.trim()) return;
    setBusy(true); setNotice(null);
    try {
      await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: participantToken, body: message.trim() }) }));
      setMessage('');
      await refreshMe(participantToken);
      setNotice({ type: 'success', text: 'Анонимный вопрос отправлен.' });
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  const sendReply = async (id: string) => {
    const body = (replyDrafts[id] || '').trim();
    if (!body || !participantToken) return;
    setBusy(true);
    try {
      await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: participantToken, body, reply_to_id: id }) }));
      setReplyDrafts(prev => ({ ...prev, [id]: '' }));
      await refreshMe(participantToken);
      setNotice({ type: 'success', text: 'Ответ отправлен анонимно.' });
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  const uploadVideo = async (file: File) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(file.type) || file.size < 1 || file.size > 50 * 1024 * 1024) {
      setNotice({ type: 'error', text: 'Выберите видео MP4, WebM или MOV размером до 50 МБ.' });
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const prepared = await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/video-greetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: participantToken, action: 'prepare', content_type: file.type, size: file.size }),
      }));
      const uploadResponse = await fetch(prepared.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('Не удалось загрузить видео. Попробуйте ещё раз.');
      await readJson(await fetch('/api/games/' + encodeURIComponent(slug) + '/video-greetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: participantToken, action: 'complete', greeting_id: prepared.greetingId }),
      }));
      await refreshMe(participantToken);
      setNotice({ type: 'success', text: 'Видео-поздравление отправлено твоему получателю.' });
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(gameUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setNotice({ type: 'error', text: 'Не удалось скопировать ссылку. Скопируйте адрес из строки браузера.' }); }
  };
  const dateLabel = (value?: string) => value ? new Date(value + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Не указано';
  const participantCount = participants.length;
  const existingRestrictionKeys = useMemo(() => new Set(restrictions.map(item => item.giver_id + ':' + item.receiver_id)), [restrictions]);

  if (loading) return <div className="game-loading"><div className="game-loader"/><span>Готовим немного волшебства…</span></div>;
  if (!game) return <div className="game-loading"><Gift size={30}/><h2>Игра не найдена</h2><p>{notice?.text || 'Проверьте ссылку и попробуйте ещё раз.'}</p><a className="game-button" href="/">На главную</a></div>;

  return <div className="game-shell">
    <header className="game-topbar"><a className="brand" href="/"><span className="brand-mark"><Gift size={17}/></span><span>ТАЙНЫЙ САНТА</span></a><span className="game-lock"><LockKeyhole size={14}/> Тайные назначения защищены</span><a href="/" aria-label="На главную"><ArrowLeft size={17}/></a></header>
    <main className="game-main">
      {notice && <div role="status" style={{padding:'12px 15px',marginBottom:16,background:notice.type==='error'?'#f7e5e0':'#e7eee2',color:notice.type==='error'?'#8c3737':'#3d6844',fontSize:12,display:'flex',justifyContent:'space-between',gap:10}}>{notice.text}<button onClick={()=>setNotice(null)} aria-label="Закрыть уведомление" style={{border:0,background:'transparent',color:'inherit'}}><X size={15}/></button></div>}
      {!isOrganizer && !isParticipant && <>
        <section className="game-hero-card"><div className="game-hero-content"><div className="eyebrow"><Sparkles size={13}/> КОРПОРАТИВНАЯ ИГРА</div><h1>{game.name}</h1><p>{game.company_name}</p><p>{game.rules || 'Подарки, маленькие секреты и праздничное настроение.'}</p><div className="game-meta-grid"><div><span>БЮДЖЕТ ПОДАРКА</span><strong>{Number(game.budget).toLocaleString('ru-RU')} ₽</strong></div><div><span>ДЕНЬ ОБМЕНА</span><strong>{dateLabel(game.exchange_date)}</strong></div><div><span>РЕГИСТРАЦИЯ ДО</span><strong>{dateLabel(game.registration_deadline)}</strong></div></div>{game.status==='registration' ? <button className="button button-gold" onClick={()=>setShowJoin(true)}>Присоединиться <ArrowRight size={16}/></button> : <p>Регистрация закрыта. Если у вас есть личная ссылка, откройте её на этом устройстве.</p>}</div><div className="game-hero-gift"><div className="orbit"/><div className="gift-box"><div className="gift-lid"/><div className="gift-body"><div className="gift-ribbon-v"/><div className="gift-ribbon-h"/><div className="gift-bow"><i/><i/></div></div></div><div className="art-caption">Секрет уже в пути.</div></div></section>
        <section className="joined-people"><div className="joined-copy"><div className="eyebrow">КОМАНДА СОБИРАЕТСЯ</div><h2>Уже участвуют <em>{participantCount}</em></h2><p>Список обновляется автоматически. Имена участников видны команде, назначения останутся секретом.</p></div><div className="joined-orbit">{participants.length ? participants.slice(0,12).map((person,index)=><div className="joined-bubble" key={person.id} style={{animationDelay:((index % 6) * 0.13) + 's'}}><div className={'joined-avatar joined-tone-'+(index%4+1)}>{initials(person.display_name)}</div><span>{person.display_name}</span></div>) : <div className="joined-empty"><div className="joined-avatar joined-avatar-empty"><Users size={18}/></div><span>Будьте первым участником</span></div>}</div></section>
        <section className="game-panel"><h2>Как присоединиться</h2><p className="game-muted">Нажмите «Присоединиться», укажите имя и при желании добавьте отдел и пожелания к подарку. Личная ссылка сохранит доступ к вашему кабинету на этом устройстве.</p><button className="game-button gold" onClick={()=>setShowJoin(true)} disabled={game.status!=='registration'}>{game.status==='registration'?'Вступить в игру':'Регистрация закрыта'} <ArrowRight size={15}/></button></section>
      </>}
      {isOrganizer && <>
        <section className="game-page-heading"><div><div className="eyebrow"><ShieldCheck size={13}/> ПАНЕЛЬ ОРГАНИЗАТОРА</div><h1>{game.name}</h1><p className="game-muted">{game.company_name} · {dateLabel(game.exchange_date)}</p></div><div className="game-heading-actions"><button className="game-button light" onClick={()=>void refreshAdmin(organizerToken)}><RefreshCw size={14}/> Обновить</button><button className="game-button" onClick={()=>void copyInvite()}><Copy size={14}/>{copied?'Скопировано':'Ссылка-приглашение'}</button></div></section>
        <div className="game-stats-row"><div><Users size={20}/><span>Участники</span><strong>{participants.length}</strong></div><div><Gift size={20}/><span>Бюджет</span><strong>{Number(game.budget).toLocaleString('ru-RU')} ₽</strong></div><div><LockKeyhole size={20}/><span>Статус</span><strong style={{fontSize:14}}>{game.status==='registration'?'Регистрация':'Жеребьёвка готова'}</strong></div></div>
        <section className="game-panel"><div className="game-panel-heading"><div><h2>Приглашение команды</h2><p className="game-muted">Отправьте ссылку в рабочий чат. Новые участники появятся здесь автоматически каждые 12 секунд.</p></div><button className="game-button light" onClick={()=>void copyInvite()}><Copy size={14}/> Копировать</button><a className="game-button gold" href={"/g/"+slug+"/banner"} target="_blank" rel="noreferrer">Баннер A4 для печати</a></div><div className="game-share-layout"><p className="game-muted" style={{overflowWrap:'anywhere'}}>{gameUrl}</p><div className="game-qr"><img src={'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data='+encodeURIComponent(gameUrl)} alt="QR-код приглашения"/><span>QR-код игры</span></div></div></section>
        <section className="game-panel"><div className="game-panel-heading"><div><h2>Участники</h2><p className="game-muted">Скрытые назначения не отображаются в панели.</p></div><span className="game-muted">{participants.length} чел.</span></div>{participants.length ? participants.map((person,index)=><div className="game-person-row" key={person.id}><div className="game-person-avatar">{initials(person.display_name)}</div><div><div className="game-person-name">{person.display_name}</div><div className="game-person-sub">{person.department || 'Отдел не указан'}</div></div><div className="game-person-wish">{person.wishlist || 'Пожеланий пока нет'}</div><div className="game-person-sub">{person.gift_state==='delivered'?'Вручён':person.gift_state==='prepared'?'Подготовлен':'—'}</div></div>) : <div className="game-empty-inline">Пока никто не присоединился. Поделитесь ссылкой с командой.</div>}</section>
        {game.status==='registration' && <section className="game-panel"><h2>Ограничения жеребьёвки</h2><p className="game-muted">Например, супруги или руководитель и сотрудник не должны выпадать друг другу. Добавляйте только направленные ограничения.</p><form className="game-restriction-form" onSubmit={e=>{e.preventDefault();void saveRestriction('add')}}><label>Кто не дарит<select value={giverId} onChange={e=>setGiverId(e.target.value)} required><option value="">Выберите участника</option>{participants.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label><label>Кому не дарит<select value={receiverId} onChange={e=>setReceiverId(e.target.value)} required><option value="">Выберите участника</option>{participants.filter(p=>p.id!==giverId).map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label><button className="game-button light" disabled={busy||!giverId||!receiverId}>Добавить</button></form>{restrictions.length>0&&<div className="game-restrictions-list">{restrictions.map((r,index)=><div className="game-restriction-item" key={r.id||r.giver_id+':'+r.receiver_id}><span>{participants.find(p=>p.id===r.giver_id)?.display_name||'Участник'} → {participants.find(p=>p.id===r.receiver_id)?.display_name||'Участник'}</span><button className="game-button light" onClick={()=>void saveRestriction('remove',r)} disabled={busy}>Удалить</button></div>)}</div>}</section>}
        <section className="game-draw-callout"><div><h3>{game.status==='registration'?'Время устроить сюрприз?':'Жеребьёвка проведена'}</h3><p>{game.status==='registration'?'Перед запуском проверьте список и ограничения. Если полного корректного распределения нет, назначения не будут сохранены.':'Участники видят только своего получателя. Повторно запустить жеребьёвку нельзя.'}</p></div>{game.status==='registration'&&<button className="game-button gold" disabled={busy||participants.length<2} onClick={()=>void draw()}><Sparkles size={15}/> Провести жеребьёвку</button>}</section>
      </>}
      {isParticipant && me && <>
        <section className="game-page-heading"><div><div className="eyebrow"><LockKeyhole size={13}/> ЛИЧНЫЙ КАБИНЕТ</div><h1>Привет, {me.participant.display_name}!</h1><p className="game-muted">{me.game.name} · бюджет {Number(me.game.budget).toLocaleString('ru-RU')} ₽</p></div><button className="game-button light" onClick={()=>void refreshMe(participantToken)}><RefreshCw size={14}/> Обновить</button></section>
        {me.game.status==='registration' ? <section className="game-panel"><h2>Ты в игре!</h2><p className="game-muted">Жеребьёвка ещё не проведена. Пока можно добавить пожелания, чтобы Тайному Санте было проще выбрать подарок.</p><form className="game-form" onSubmit={e=>{e.preventDefault();void saveMe({wishlist})}}><label>Мои пожелания<textarea rows={4} maxLength={1000} value={wishlist || me.participant.wishlist || ''} onChange={e=>setWishlist(e.target.value)} placeholder="Что тебе нравится? Что точно не хочется получить?"/></label><button className="game-button gold" disabled={busy}>Сохранить пожелания</button></form></section> : <section className="game-recipient-card"><div className="game-recipient-side"><div className="eyebrow"><Gift size={13}/> ТВОЙ ПОЛУЧАТЕЛЬ</div>{me.recipient ? <><div className="game-recipient-person" style={{marginTop:20}}><div className="game-icon-circle">{initials(me.recipient.display_name)}</div><div><h2>{me.recipient.display_name}</h2><span>{me.recipient.department || 'Отдел не указан'}</span></div></div><div className="game-wishlist"><span>ПОЖЕЛАНИЯ</span><p>{me.recipient.wishlist || 'Получатель пока не добавил пожелания.'}</p></div><div className="game-gift-status"><span>Мой подарок</span><div className="game-status-buttons">{([{value:'pending',label:'В планах'},{value:'prepared',label:'Готов'},{value:'delivered',label:'Вручён'}] as const).map(item=><button key={item.value} className={me.participant.gift_state===item.value?'active':''} onClick={()=>void saveMe({gift_state:item.value})} disabled={busy}>{item.label}</button>)}</div></div></> : <p>Назначение не найдено. Обновите страницу или обратитесь к организатору.</p>}</div><div className="game-recipient-note"><div className="game-icon-circle"><LockKeyhole size={20}/></div><h3>Твоя тайна</h3><strong>{me.participant.revealed_at?'Ты раскрылся':'🤫'}</strong><span>{me.participant.revealed_at?'Твоё имя теперь раскрыто получателю.':'Никто не узнает, что подарок от тебя, пока ты сам не решишь раскрыться.'}</span>{!me.participant.revealed_at&&<button className="game-button gold" style={{marginTop:20}} onClick={()=>{if(window.confirm('Раскрыть получателю, что подарок от тебя?'))void saveMe({reveal:true})}} disabled={busy}>Раскрыть себя</button>}</div></section>}
        {me.game.status!=='registration' && <section className="game-panel"><h2>Анонимный вопрос</h2><p className="game-muted">Спроси своего получателя о размере, цвете или пожеланиях. Имя отправителя останется скрытым.</p><form className="game-message-form" onSubmit={sendMessage}><textarea rows={3} value={message} onChange={e=>setMessage(e.target.value)} maxLength={1000} placeholder="Например: тебе больше нравится чай или кофе?"/><button className="game-button gold" disabled={busy||!message.trim()}><Send size={14}/> Отправить анонимно</button></form><div className="game-message-group"><h3>Ответы и вопросы</h3>{me.inbox.length===0&&me.outbox.length===0?<div className="game-empty-inline">Пока сообщений нет.</div>:<>{me.inbox.map(item=><article className="game-message-card" key={item.id}><span className="game-message-label">Вопрос от Тайного Санты</span><p>{item.body}</p><form className="game-reply-form" onSubmit={e=>{e.preventDefault();void sendReply(item.id)}}><input value={replyDrafts[item.id]||''} onChange={e=>setReplyDrafts(prev=>({...prev,[item.id]:e.target.value}))} placeholder="Ответить анонимно" maxLength={1000}/><button type="submit" disabled={busy||!(replyDrafts[item.id]||'').trim()} aria-label="Отправить ответ"><Send size={14}/></button></form></article>)}{me.outbox.map(item=><article className="game-message-card" key={item.id}><span className="game-message-label">Твой анонимный вопрос</span><p>{item.body}</p>{item.answer?<div className="game-message-answer">Ответ: {item.answer}</div>:<span className="game-message-label">Ответ пока не получен</span>}</article>)}</>}</div></section>}
        {me.game.status!=='registration' && <section className="game-panel video-greeting-panel"><h2>Видео-поздравление</h2><p className="game-muted">Запиши короткое поздравление для своего получателя. Видео доступно только ему, формат MP4, WebM или MOV, до 50 МБ.</p>{me.myVideoGreeting?.uploaded_at ? <div className="video-sent-state"><Check size={20}/><div><strong>Поздравление отправлено</strong><span>Получатель сможет посмотреть его в личном кабинете.</span></div></div> : <label className="video-upload-control"><Video size={21}/><span>{busy?'Загрузка…':'Выбрать видео для отправки'}</span><small>MP4 / WebM / MOV · до 50 МБ</small><input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={busy} onChange={event=>{const file=event.currentTarget.files?.[0];if(file)void uploadVideo(file);event.currentTarget.value='';}}/></label>}{me.receivedVideoGreetings?.length ? <><h3 style={{fontSize:14,margin:'22px 0 12px'}}>Видео для тебя</h3><div className="received-video-list">{me.receivedVideoGreetings.map(video=><article className="received-video-card" key={video.id}><div className="received-video-head"><div className="joined-avatar"><Video size={17}/></div><div><strong>{video.sender_label}</strong><span>{dateLabel(video.created_at.slice(0,10))}</span></div></div><video controls playsInline preload="metadata" src={video.url}/></article>)}</div></> : <p className="game-muted" style={{marginTop:12}}>Когда тебе отправят видео, оно появится здесь.</p>}</section>}
        <section className="game-panel"><h2>Твоя личная ссылка</h2><p className="game-muted">Сохрани ссылку, чтобы снова открыть личный кабинет на другом устройстве.</p><button className="game-button light" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);setNotice({type:'success',text:'Личная ссылка скопирована.'})}catch{setNotice({type:'error',text:'Не удалось скопировать ссылку.'})}}}><Copy size={14}/> Скопировать личную ссылку</button></section>
      </>}
      <footer className="game-footer"><span>ТАЙНЫЙ САНТА</span><span>Сохраняйте интригу до нужного момента.</span><a href="/">На главную</a></footer>
    </main>
    {showJoin && <div className="modal-backdrop" onClick={()=>setShowJoin(false)}><section className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowJoin(false)} aria-label="Закрыть"><X/></button><div className="eyebrow">ТВОЯ КОМАНДА ЖДЁТ</div><h2>Присоединиться</h2><p className="modal-intro">Укажи имя, чтобы команда узнала, что ты участвуешь. Личная ссылка будет создана автоматически.</p><form onSubmit={joinGame}><label>Имя и фамилия<input value={displayName} onChange={e=>setDisplayName(e.target.value)} required maxLength={80} placeholder="Например, Анна Смирнова"/></label><label>Отдел (необязательно)<input value={department} onChange={e=>setDepartment(e.target.value)} maxLength={80} placeholder="Например, Маркетинг"/></label><label>Пожелания к подарку<textarea value={wishlist} onChange={e=>setWishlist(e.target.value)} maxLength={1000} rows={3} placeholder="Хобби, любимые вещи, чего лучше не дарить"/></label><button className="button button-gold button-full" type="submit" disabled={busy}>{busy?'Добавляем…':'Вступить в игру'} <ArrowRight size={16}/></button></form></section></div>}
  </div>;
}
