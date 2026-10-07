"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { AuthStage } from "./AuthStage";

type Notice = { type: "success" | "error"; text: string } | null;

type AuthScreenProps = {
  mode: "setup-required" | "login";
  notice: Notice;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDismiss: () => void;
};

function Brand() {
  return (
    <a className="brand" href="#inicio">
      <span className="brand-icon"><span /></span>
      <span>parkflow<span className="brand-dot">.</span><small>CONTROL DE ESTACIONAMIENTO</small></span>
    </a>
  );
}

export function AuthScreen({ mode, notice, busy, onSubmit, onDismiss }: AuthScreenProps) {
  const setupRequired = mode === "setup-required";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <Brand />
        <div className="auth-story">
          <span className="eyebrow"><span className="status-dot" /> OPERACIÓN MÁS CLARA</span>
          <h1>Tu estacionamiento,<br /><em>bajo control.</em></h1>
          <p>Organiza ingresos, capacidad y tarifas desde un solo lugar.</p>
        </div>
        <AuthStage />
        <div className="auth-footer">PARKFLOW · CONTROL DE ESTACIONAMIENTO</div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><Brand /></div>
          <span className="eyebrow">{setupRequired ? "PRIMER ACCESO" : "BIENVENIDO DE VUELTA"}</span>
          <h2>{setupRequired ? "Crea el acceso desde CLI" : "Inicia sesión"}</h2>
          <p className="form-intro">
            {setupRequired
              ? "Por seguridad, la cuenta administradora se provisiona desde una terminal del servidor."
              : "Ingresa tus credenciales para entrar a la consola."}
          </p>

          {setupRequired ? (
            <pre className="cli-command">cd apps/api && ./mvnw spring-boot:run -Dspring-boot.run.arguments=--create-admin</pre>
          ) : (
            <>
              {notice && (
                <div className={`notice notice-${notice.type}`} role="alert">
                  <span>{notice.text}</span>
                  <button type="button" onClick={onDismiss} aria-label="Cerrar aviso"><X size={16} /></button>
                </div>
              )}
              <form className="stack-form" onSubmit={onSubmit}>
                <label className="field">
                  <span>Correo electrónico</span>
                  <input name="username" type="email" placeholder="nombre@estacionamiento.pe" required autoComplete="username" autoFocus />
                </label>
                <label className="field">
                  <span>Contraseña</span>
                  <span className="password-wrap">
                    <input name="password" type={showPassword ? "text" : "password"} placeholder="Tu contraseña" required autoComplete="current-password" />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                <button className="primary-button full-button" disabled={busy}>
                  {busy ? <><LoaderCircle size={18} className="spin" /> Un momento…</> : <>Entrar al panel<span aria-hidden="true">→</span></>}
                </button>
              </form>
            </>
          )}

          <div className="secure-note"><ShieldCheck size={16} /> Acceso protegido y contraseñas protegidas con BCrypt</div>
        </div>
      </section>
    </main>
  );
}
