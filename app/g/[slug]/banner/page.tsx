'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';

export default function PrintableBannerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [game, setGame] = useState<any>(null);
  const [origin, setOrigin] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
    fetch('/api/games/' + encodeURIComponent(slug), { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Не удалось загрузить игру'); setGame(d.game); })
      .catch(e => setError(e.message || 'Ошибка загрузки'));
  }, [slug]);
  const url = origin ? origin + '/g/' + slug : '';
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#10291f', light: '#ffffff' },
    }).then((dataUrl) => {
      if (!cancelled) setQrCode(dataUrl);
    }).catch(() => {
      if (!cancelled) setError('Не удалось создать QR-код. Обновите страницу.');
    });
    return () => { cancelled = true; };
  }, [url]);
  const date = (s?: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Уточните у организатора';
  if (error) return <main style={{padding:24}}>{error}<p><a href={'/g/'+slug}>Назад в игру</a></p></main>;
  if (!game || !origin || !qrCode) return <main style={{padding:24}}>Готовим макет…</main>;
  return <main>
    <style jsx global>{`
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #f1ede4; }
      .poster { width: 210mm; height: 297mm; margin: 12px auto; padding: 15mm; background: radial-gradient(ellipse at 51% 29%, #214631 0%, #10291f 48%, #091b13 100%); color: #f3ebdd; font-family: 'DM Sans', Arial, sans-serif; text-align: center; }
      .frame { height: 100%; border: 1px solid #d5bd84; outline: 1px solid #c8a96a; outline-offset: 4mm; padding: 10mm 8mm; display:flex; flex-direction:column; align-items:center; }
      .kicker { color:#d5bd84; letter-spacing:.2em; font-size:10pt; font-weight:bold; }
      .stars { color:#d7bc7a; margin:8mm 0 2mm; font-size:18pt; }
      .poster-art { height: 30mm; width: 100%; display: grid; place-items: center; margin: 1mm 0 3mm; }
      .poster-art svg { height: 100%; width: auto; max-width: 75mm; overflow: visible; filter: drop-shadow(0 5mm 3mm rgba(0,0,0,.28)); }
      h1 { font-family: 'Playfair Display', Georgia,serif; font-size:40pt; line-height:1; margin:0; }
      .company { color:#ded0ac; font-size:17pt; letter-spacing:.14em; font-weight:bold; margin-top:7mm; }
      .rule { width:34mm; border-top:1px solid #c8a96a; margin:7mm 0; }
      .subtitle { font: 20pt Georgia,serif; margin:0; }
      .desc { font-size:11pt; line-height:1.55; max-width:140mm; margin:5mm auto; }
      .details { display:flex; gap:5mm; width:100%; margin-top:5mm; }
      .detail { flex:1; border:1px solid #c8a96a; border-radius:4mm; padding:4mm 2mm; background:rgba(255,255,255,.035); }
      .detail span { display:block; color:#d7bc7a; font-size:8pt; margin-bottom:2mm; letter-spacing:.08em; }
      .detail strong { font-size:11pt; }
      .cta { margin-top:auto; padding-top:7mm; font-size:14pt; font-weight:bold; }
      .qrbox { background:#fff; padding:4mm; margin-top:4mm; border-radius:4mm; box-shadow:0 2mm 7mm rgba(0,0,0,.22); }
      .qr { width:43mm; height:43mm; display:block; }
      .scan { color:#e6d5ad; font-size:9pt; margin-top:3mm; }
      .url { font-size:7pt; margin-top:2mm; overflow-wrap:anywhere; }
      .footer { color:#d7bc7a; font-size:8pt; letter-spacing:.12em; margin-top:6mm; }
      .actions { display:flex; justify-content:center; gap:12px; margin:16px; font-family:Arial,sans-serif; }
      .actions button,.actions a { background:#173a29; color:#f3ebdd; border:1px solid #d5bd84; border-radius:999px; padding:12px 18px; text-decoration:none; cursor:pointer; }
      @media print { body { background:#123b2e; print-color-adjust:exact; -webkit-print-color-adjust:exact; } .poster { margin:0; } .actions { display:none; } }
    `}</style>
    <section className="poster"><div className="frame">
      <div className="kicker">ПРАЗДНИЧНАЯ ИГРА КОМАНДЫ</div>
      <h1>Тайный<br/>Санта</h1>
      <div className="poster-art" aria-hidden="true">
        <svg viewBox="0 0 240 132" role="presentation">
          <defs>
            <linearGradient id="boxFace" x1="48" y1="53" x2="151" y2="116" gradientUnits="userSpaceOnUse"><stop stop-color="#b95049"/><stop offset=".55" stop-color="#842f34"/><stop offset="1" stop-color="#5c2029"/></linearGradient>
            <linearGradient id="boxSide" x1="151" y1="54" x2="195" y2="105" gradientUnits="userSpaceOnUse"><stop stop-color="#7b2b33"/><stop offset="1" stop-color="#3c1821"/></linearGradient>
            <linearGradient id="ribbon" x1="92" y1="25" x2="123" y2="110" gradientUnits="userSpaceOnUse"><stop stop-color="#fff0bd"/><stop offset=".3" stop-color="#dabb77"/><stop offset=".62" stop-color="#f2d998"/><stop offset="1" stop-color="#8a6231"/></linearGradient>
            <linearGradient id="lidFace" x1="42" y1="43" x2="177" y2="57" gradientUnits="userSpaceOnUse"><stop stop-color="#c46a58"/><stop offset=".62" stop-color="#99403e"/><stop offset="1" stop-color="#67262f"/></linearGradient>
          </defs>
          <ellipse cx="121" cy="116" rx="76" ry="10" fill="#030e08" opacity=".48"/>
          <path d="M50 52 75 32 191 42 162 61Z" fill="#cb745c" stroke="#e3ad82" stroke-opacity=".45"/>
          <path d="M162 61 191 42 191 98 162 116Z" fill="url(#boxSide)"/>
          <path d="M50 52 162 61 162 116 50 108Z" fill="url(#boxFace)"/>
          <path d="M91 55 112 57 112 112 91 110Z" fill="url(#ribbon)"/>
          <path d="M50 76 162 84 162 99 50 91Z" fill="url(#ribbon)"/>
          <path d="M162 84 191 65 191 80 162 99Z" fill="#a27b43"/>
          <path d="M42 43 71 20 201 31 172 55Z" fill="url(#lidFace)" stroke="#e4b084" stroke-opacity=".65"/>
          <path d="M42 43 172 55 172 69 42 56Z" fill="#91393b"/>
          <path d="M172 55 201 31 201 46 172 69Z" fill="#61242e"/>
          <path d="M100 34c-34-25-52-14-38 1 11 11 30 11 40 8-12-24-1-42 11-30 11 10 1 24-13 30 29-20 43-5 26 3-8 4-18 3-26-1" fill="url(#ribbon)" stroke="#f5dda0" stroke-width="2" stroke-linejoin="round"/>
          <ellipse cx="101" cy="39" rx="6" ry="5" fill="#f6dfa1" stroke="#fff0bf" stroke-width="1"/>
          <path d="m35 60 4-9 4 9 9 4-9 4-4 9-4-9-9-4Z" fill="#edd59c"/>
          <path d="m205 79 3-7 3 7 7 3-7 3-3 7-3-7-7-3Z" fill="#edd59c" opacity=".85"/>
          <circle cx="70" cy="16" r="2" fill="#f3dda9"/><circle cx="207" cy="105" r="2" fill="#f3dda9"/>
        </svg>
      </div>
      <div className="company">{game.company_name || 'ЛИДЕР-ФУД'}</div>
      <div className="rule"/>
      <p className="subtitle">Подари немного волшебства коллеге</p>
      <p className="desc">Присоединяйся к праздничному обмену подарками! Получи имя своего получателя, выбери подарок и сохрани секрет до самого вручения.</p>
      <div className="details"><div className="detail"><span>БЮДЖЕТ ПОДАРКА</span><strong>{Number(game.budget).toLocaleString('ru-RU')} ₽</strong></div><div className="detail"><span>ДЕНЬ ОБМЕНА</span><strong>{date(game.exchange_date)}</strong></div></div>
      <div className="cta">Сканируй QR-код и участвуй</div>
      <div className="qrbox"><img className="qr" src={qrCode} alt="QR-код игры"/></div>
      <div className="scan">Откроется регистрация в игре «{game.name}»</div>
      <div className="url">{url}</div>
      <div className="footer">СЕКРЕТЫ • ПОДАРКИ • ПРАЗДНИЧНОЕ НАСТРОЕНИЕ</div>
    </div></section>
    <div className="actions"><button onClick={() => window.print()}>Распечатать / сохранить PDF</button><a href={'/g/'+slug}>Назад в игру</a></div>
  </main>;
}
