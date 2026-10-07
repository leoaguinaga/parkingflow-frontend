import type { CSSProperties } from "react";

/**
 * Escenario izquierdo de la pantalla de acceso: un estacionamiento visto desde arriba
 * que recorre el proceso completo (llegada → lectura de placa → barrera → espacio
 * asignado → estadía → salida → pago → barrera → calle).
 * Todo el movimiento es CSS (auth.css, sección "Escena de estacionamiento");
 * este componente solo dibuja el mundo de 960×720 px.
 */

type ParkedCar = { x: number; y: number; r: 90 | -90; color: string };

const SLOT_X = [290, 350, 410, 470, 530, 590, 650];
const PARKED_COLORS = ["#cdd8e4", "#ffffff", "#b6c6d8", "#e3e9f0", "#9db7e0", "#ffffff", "#c2cfdd"];
const PARKED: ParkedCar[] = [
  ...SLOT_X.filter((x) => x !== 470).map((x) => ({ x, y: 105, r: 90 as const })),
  ...[290, 350, 470, 590, 650].map((x) => ({ x, y: 245, r: -90 as const })),
  ...[290, 410, 470, 530, 590].map((x) => ({ x, y: 455, r: 90 as const })),
].map((car, index) => ({ ...car, color: PARKED_COLORS[index % PARKED_COLORS.length] }));

function Car({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <div className={`car ${className}`} style={style}>
      <svg viewBox="0 0 76 40">
        <rect className="car-paint" x=".5" y=".5" width="75" height="39" rx="11.5" />
        <rect className="car-glass" x="8" y="7" width="9" height="26" rx="4" />
        <rect className="car-roof" x="20" y="6" width="28" height="28" rx="6" />
        <path className="car-glass" d="M51 6h8a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4h-8z" />
        <rect className="car-light" x="70" y="6" width="4" height="7" rx="2" />
        <rect className="car-light" x="70" y="27" width="4" height="7" rx="2" />
        <rect className="car-tail" x="2" y="7" width="3" height="6" rx="1.5" />
        <rect className="car-tail" x="2" y="27" width="3" height="6" rx="1.5" />
      </svg>
    </div>
  );
}

function Ground() {
  return (
    <svg className="park-ground" width="2880" height="1440" viewBox="-960 -720 2880 1440">
      <defs>
        <linearGradient id="park-scan" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eea83d" stopOpacity=".6" />
          <stop offset="1" stopColor="#eea83d" stopOpacity=".06" />
        </linearGradient>
      </defs>
      <rect x="110" y="30" width="740" height="600" rx="22" fill="#e4ebf3" />
      <rect x="-960" y="630" width="2880" height="90" fill="#d9e2eb" />
      <path d="M-960 620H150v10H-960zM230 620h500v10H230zM810 620h1110v10H810z" fill="#edf2f7" />
      <path d="M-960 675H1920" stroke="#fff" strokeWidth="2" strokeDasharray="18 14" opacity=".9" />
      <g stroke="#fff" strokeWidth="2" opacity=".95">
        {[260, 320, 380, 440, 500, 560, 620, 680].map((x) => (
          <path key={x} d={`M${x} 50V160M${x} 190V300M${x} 400V510`} />
        ))}
        <path d="M260 50H680M260 190H680M260 510H680" />
      </g>
      <rect x="260" y="166" width="420" height="18" rx="9" fill="#d5e8dc" />
      <rect x="296" y="528" width="368" height="86" rx="14" fill="#d5e8dc" />
      <g fill="#b9d9c4">
        <circle cx="300" cy="175" r="9" />
        <circle cx="470" cy="175" r="9" />
        <circle cx="640" cy="175" r="9" />
        <circle cx="330" cy="598" r="11" />
        <circle cx="630" cy="598" r="11" />
      </g>
      <g fontFamily="Arial, Helvetica, sans-serif" fontSize="9" fontWeight="700" fill="#9aabbd" textAnchor="middle" letterSpacing=".5">
        {SLOT_X.map((x, index) => (
          <g key={x}>
            <text x={x} y="296">A-0{index + 1}</text>
            <text x={x} y="409">B-0{index + 1}</text>
          </g>
        ))}
      </g>
      <g stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".95">
        <path d="M-6-8 6 0-6 8" transform="translate(480 350)" />
        <path d="M-6-8 6 0-6 8" transform="translate(190 470) rotate(-90)" />
        <path d="M-6-8 6 0-6 8" transform="translate(770 420) rotate(90)" />
      </g>
      <rect className="park-slot park-slot-a" x="383" y="193" width="54" height="104" rx="6" fill="#31bd81" fillOpacity=".16" stroke="#31bd81" strokeWidth="2" />
      <rect className="park-slot park-slot-b" x="623" y="403" width="54" height="104" rx="6" fill="#31bd81" fillOpacity=".16" stroke="#31bd81" strokeWidth="2" />
      <path className="park-route park-route-a" pathLength={1} d="M 190 592 L 190 430 Q 190 350 270 350 L 350 350 Q 410 350 410 290 L 410 245" />
      <path className="park-route park-route-b" pathLength={1} d="M 190 592 L 190 430 Q 190 350 270 350 L 590 350 Q 650 350 650 410 L 650 455" />
      <polygon className="park-scan-cone" points="246,523 166,558 214,558" fill="url(#park-scan)" />
      <rect x="240" y="518" width="44" height="44" rx="9" fill="#fff" stroke="#cfd9e4" />
      <rect x="248" y="526" width="28" height="28" rx="5" fill="#eaf0f6" />
      <circle cx="246" cy="523" r="4" fill="#1f3147" />
      <rect x="676" y="518" width="44" height="44" rx="9" fill="#fff" stroke="#cfd9e4" />
      <rect x="684" y="526" width="28" height="28" rx="5" fill="#eaf0f6" />
      <circle className="park-terminal" cx="714" cy="523" r="4" />
      <g fill="#607d9e">
        <circle cx="234" cy="540" r="6" />
        <circle cx="726" cy="540" r="6" />
      </g>
    </svg>
  );
}

export function AuthStage() {
  return (
    <div className="auth-stage" aria-hidden="true">
      <div className="park-viewport">
        <div className="park-world">
          <Ground />
          {PARKED.map((car) => (
            <Car
              key={`${car.x}-${car.y}`}
              className="car-parked"
              style={{ left: car.x - 38, top: car.y - 20, "--r": `${car.r}deg`, "--car": car.color } as CSSProperties}
            />
          ))}
          <Car className="car-moving car-street" />
          <Car className="car-moving car-hero car-a-in" />
          <Car className="car-moving car-hero car-a-out" />
          <Car className="car-moving car-b-in" />
          <Car className="car-moving car-b-out" />

          <div className="park-plate-frame"><i /><i /><i /><i /></div>
          <div className="park-arm park-arm-in" />
          <div className="park-arm park-arm-out" />

          <div className="park-sign">
            <span className="park-sign-p">P</span>
            <span className="park-sign-text">
              <small>LIBRES</small>
              <span className="park-sign-digits"><span><b>13</b><b>12</b></span></span>
            </span>
          </div>

          <div className="park-chip park-chip-in park-chip-a"><small>INGRESO · 08:42</small><strong>ABC-123 <em>A-03</em></strong></div>
          <div className="park-chip park-chip-in park-chip-b"><small>INGRESO · 08:57</small><strong>LMN-457 <em>B-07</em></strong></div>
          <div className="park-chip park-chip-pay park-chip-a"><small>SALIDA · 2H 10M</small><strong>S/ 6.50 <em>PAGADO</em></strong></div>
          <div className="park-chip park-chip-pay park-chip-b"><small>SALIDA · 1H 05M</small><strong>S/ 3.50 <em>PAGADO</em></strong></div>
          <div className="park-badge park-badge-a">✓ A-03</div>
          <div className="park-badge park-badge-b">✓ B-07</div>
        </div>
      </div>
    </div>
  );
}
