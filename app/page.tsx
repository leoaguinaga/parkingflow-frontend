"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CarFront, Clock3, LogOut, Menu, Motorbike, Settings2, Users, Warehouse, Plus, Search, Printer, Ban, Pencil, X, History as HistoryIcon } from "lucide-react";
import { AuthScreen } from "@/features/auth/components/AuthScreen";
import { listOfflineEntries, removeOfflineEntry, saveOfflineEntry, type OfflineEntry } from "./offline-queue";

type User = { firstName: string; lastName: string; email: string; role: string; siteId: string; siteName: string };
type VehicleType = { id: string; code: string; name: string; capacity: number | null; hourlyAmount: number | null; graceMinutes: number | null; billingIncrementMinutes: number | null; nightPeriodName: string | null; nightStartsAt: string | null; nightEndsAt: string | null; nightHourlyAmount: number | null };
type Configuration = { site: { id: string; name: string; address: string; timeZone: string }; vehicleTypes: VehicleType[] };
type Notice = { type: "success" | "error"; text: string } | null;

const API = "/api";
const vehicleIcons: Record<string, typeof CarFront> = { CAR: CarFront, MOTORCYCLE: Motorbike, VAN: Warehouse };
const currency = (amount: number | null) => amount == null ? "—" : new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [mode, setMode] = useState<"loading" | "setup-required" | "login" | "dashboard">("loading");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [section, setSectionState] = useState<"overview" | "settings" | "users" | "operations" | "exits" | "history">("overview");
  const setSection = (next: typeof section) => { setNotice(null); setSectionState(next); };
  const [operationsView, setOperationsView] = useState<"tickets" | "vehicles">("tickets");
  const [printCode, setPrintCode] = useState<string | null>(null);

  const csrfHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const cookieToken = document.cookie.split("; ").find((cookie) => cookie.startsWith("XSRF-TOKEN="))?.split("=").slice(1).join("=");
    if (cookieToken) return { "X-XSRF-TOKEN": decodeURIComponent(cookieToken) };
    const response = await fetch(`${API}/auth/csrf`, { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo preparar la sesión segura.");
    const token = document.cookie.split("; ").find((cookie) => cookie.startsWith("XSRF-TOKEN="))?.split("=").slice(1).join("=");
    if (!token) throw new Error("No se recibió el token de seguridad.");
    return { "X-XSRF-TOKEN": decodeURIComponent(token) };
  }, []);

  async function loadUsers() {
    const response = await fetch(`${API}/admin/configuration/users`, { credentials: "include" });
    if (!response.ok) throw new Error("No se pudo cargar la lista de usuarios.");
    return response.json();
  }

  async function loadConfiguration() {
    const response = await fetch(`${API}/admin/configuration`, { credentials: "include" });
    if (!response.ok) throw new Error("No se pudo cargar la configuración.");
    setConfiguration(await response.json());
  }

  async function checkSession() {
    try {
      const response = await fetch(`${API}/auth/me`, { credentials: "include" });
      if (response.ok) {
        setUser(await response.json());
        setMode("dashboard");
        return;
      }
      const setup = await fetch(`${API}/auth/setup-status`);
      setMode(setup.ok && (await setup.json()).complete ? "login" : "setup-required");
    } catch {
      setNotice({ type: "error", text: "No se pudo conectar con la API. Comprueba que Spring Boot esté activo en el puerto 8080." });
      setMode("setup-required");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void checkSession(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (mode !== "dashboard") return;
    const timer = window.setTimeout(() => { void loadConfiguration().catch((error) => setNotice({ type: "error", text: error.message })); }, 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const endpoint = "/auth/login";
      const headers = new Headers({ "Content-Type": "application/json" });
      Object.entries(await csrfHeaders()).forEach(([name, value]) => headers.set(name, value));
      const response = await fetch(`${API}${endpoint}`, { method: "POST", headers, credentials: "include", body: JSON.stringify(data) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "No se pudo completar la solicitud.");
      await checkSession();
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Ocurrió un error." }); }
    finally { setBusy(false); }
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!configuration) return;
    setBusy(true); setNotice(null);
    const form = new FormData(event.currentTarget);
    const vehicleTypes = configuration.vehicleTypes.map((vehicle) => ({
      code: vehicle.code,
      capacity: Number(form.get(`${vehicle.code}-capacity`) || 0),
      hourlyAmount: Number(form.get(`${vehicle.code}-hourlyAmount`) || 0),
      graceMinutes: Number(form.get(`${vehicle.code}-graceMinutes`) || 0),
      billingIncrementMinutes: Number(form.get(`${vehicle.code}-billingIncrementMinutes`) || 60),
      nightPeriod: form.get(`${vehicle.code}-nightName`) ? {
        name: String(form.get(`${vehicle.code}-nightName`)),
        startsAt: String(form.get(`${vehicle.code}-nightStart`)),
        endsAt: String(form.get(`${vehicle.code}-nightEnd`)),
        hourlyAmount: Number(form.get(`${vehicle.code}-nightAmount`) || 0),
      } : null,
    }));
    const payload = { siteName: form.get("siteName"), address: form.get("address"), vehicleTypes };
    try {
      const response = await fetch(`${API}/admin/configuration`, { method: "PUT", headers: { "Content-Type": "application/json", ...await csrfHeaders() }, credentials: "include", body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "No se pudo guardar la configuración.");
      await loadConfiguration(); setNotice({ type: "success", text: "Configuración guardada." });
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Ocurrió un error." }); }
    finally { setBusy(false); }
  }

  async function logout() {
    const headers = await csrfHeaders().catch(() => ({}));
    await fetch(`${API}/auth/logout`, { method: "POST", headers, credentials: "include" }).catch(() => undefined);
    setUser(null); setConfiguration(null); setMode("login"); setSection("overview");
  }

  if (mode === "loading") return <div className="loading-screen"><div className="loading-mark">P</div><p>Preparando ParkFlow…</p></div>;
  if (mode === "setup-required" || mode === "login") return <AuthScreen mode={mode} notice={notice} busy={busy} onSubmit={submitAuth} onDismiss={() => setNotice(null)} />;
  const isAdmin = user?.role === "ADMIN";

  return (
    <>
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio"><span className="brand-icon"><span /></span><span>parkflow<span className="brand-dot">.</span><small>CONTROL DE ESTACIONAMIENTO</small></span></a>
        <div className="side-label">OPERACIÓN</div>
        <button className={`nav-item ${section === "overview" ? "active" : ""}`} onClick={() => setSection("overview")}><Activity size={18} /> Resumen</button>
        <button className={`nav-item ${section === "operations" && operationsView === "tickets" ? "active" : ""}`} onClick={() => { setSection("operations"); setOperationsView("tickets"); }}><ArrowDownRight size={18} /> Ingresos</button>
        <button className={`nav-item ${section === "operations" && operationsView === "vehicles" ? "active" : ""}`} onClick={() => { setSection("operations"); setOperationsView("vehicles"); }}><CarFront size={18} /> Vehículos</button>
        <button className={`nav-item ${section === "exits" ? "active" : ""}`} onClick={() => setSection("exits")}><ArrowUpRight size={18} /> Salidas</button>
        <button className={`nav-item ${section === "history" ? "active" : ""}`} onClick={() => setSection("history")}><HistoryIcon size={18} /> Historial</button>
        {isAdmin && <><div className="side-label side-label-gap">ADMINISTRACIÓN</div><button className={`nav-item ${section === "settings" ? "active" : ""}`} onClick={() => setSection("settings")}><Settings2 size={18} /> Configuración</button><button className={`nav-item ${section === "users" ? "active" : ""}`} onClick={() => setSection("users")}><Users size={18} /> Usuarios</button></>}
        <div className="sidebar-bottom"><div className="connection-state"><span className="status-dot" /> SISTEMA CONECTADO</div><div className="profile"><div className="avatar">{user?.firstName.slice(0,1)}{user?.lastName.slice(0,1)}</div><div className="profile-info"><strong>{user?.firstName} {user?.lastName}</strong><span>{isAdmin ? "Administrador" : "Trabajador"}</span></div><button className="icon-button" onClick={logout} title="Cerrar sesión"><LogOut size={16} /></button></div></div>
      </aside>
      <section className="main-column">
        <header className="topbar"><div className="mobile-brand"><Menu size={19} /> ParkFlow</div><div className="breadcrumb">Panel <span>/</span> {section === "overview" ? "Resumen" : section === "settings" ? "Configuración" : section === "users" ? "Usuarios" : section === "exits" ? "Salidas" : section === "history" ? "Historial" : operationsView === "tickets" ? "Ingresos" : "Vehículos"}</div><div className="topbar-site"><span className="status-dot" /> {configuration?.site.name ?? user?.siteName ?? "Estacionamiento"}</div></header>
        <div className="content-area">
          {notice && <div className={`notice notice-${notice.type}`} role="status"><span>{notice.text}</span><button onClick={() => setNotice(null)}>×</button></div>}
          {section === "operations" && <OperationsPanel csrfHeaders={csrfHeaders} view={operationsView} setView={setOperationsView} onNotice={setNotice} onPrint={setPrintCode} />}
          {section === "exits" && <ExitPanel csrfHeaders={csrfHeaders} onNotice={setNotice} />}
          {section === "history" && <HistoryPanel onNotice={setNotice} />}
          {section === "overview" && <Overview user={user} configuration={configuration} onConfigure={() => setSection("settings")} onGo={(target) => { if (target === "entry") { setSection("operations"); setOperationsView("tickets"); } else setSection("exits"); }} />}
          {section === "settings" && isAdmin && configuration && <Settings key={JSON.stringify(configuration)} configuration={configuration} busy={busy} onSubmit={saveConfiguration} />}
          {section === "users" && isAdmin && <UsersPanel apiBase={API} csrfHeaders={csrfHeaders} onLoad={loadUsers} onNotice={setNotice} />}
        </div>
      </section>
    </main>
    {printCode && <TicketPrint code={printCode} onClose={() => setPrintCode(null)} />}
    </>
  );
}


type HistoryRecord = { code: string; licensePlate: string; vehicleType: string; state: string; enteredAt: string; exitedAt: string | null; amount: number | null; paymentMethod: string | null; enteredBy: string; processedBy: string | null };
type ReportSummary = { closedTickets: number; voidedTickets: number; openTickets: number; revenue: number; cash: number; yape: number; occupancy: Array<{ typeCode: string; typeName: string; capacity: number; occupied: number; available: number }> };

const HISTORY_STATES = [["ALL", "Todos"], ["CLOSED", "Cerrados"], ["OPEN", "Abiertos"], ["VOIDED", "Anulados"]] as const;
const isoDay = (date: Date) => date.toLocaleDateString("en-CA");
const shiftDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return isoDay(date); };
const shortDateTime = (value: string) => new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });

function HistoryPanel({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const today = isoDay(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [state, setState] = useState("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300); return () => window.clearTimeout(timer); }, [query]);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams({ state });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (debouncedQuery) params.set("q", debouncedQuery);
      const periodParams = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
      const [historyResponse, summaryResponse] = await Promise.all([
        fetch(`${API}/parking/tickets/history?${params}`, { credentials: "include", cache: "no-store" }),
        fetch(`${API}/parking/tickets/summary?${periodParams}`, { credentials: "include", cache: "no-store" }),
      ]);
      if (!historyResponse.ok || !summaryResponse.ok) throw new Error("El servidor no pudo responder la consulta. Tus datos están a salvo; reintenta en unos segundos.");
      setRecords(await historyResponse.json());
      setSummary(await summaryResponse.json());
      setFailure(null);
      onNotice(null);
    } catch (error) { setFailure(error instanceof Error ? error.message : "No se pudo cargar el historial."); }
    finally { setBusy(false); }
  }, [from, to, state, debouncedQuery, onNotice]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  const presets: Array<[string, string, string]> = [["Hoy", today, today], ["Ayer", shiftDays(-1), shiftDays(-1)], ["7 días", shiftDays(-6), today], ["30 días", shiftDays(-29), today]];
  const filtered = state !== "ALL" || debouncedQuery !== "";
  const occupied = summary?.occupancy.reduce((sum, item) => sum + item.occupied, 0) ?? 0;
  const capacity = summary?.occupancy.reduce((sum, item) => sum + item.capacity, 0) ?? 0;
  const ready = summary !== null && !failure;
  return <div className="operations-page history-page">
    <div className="page-heading"><div><div className="eyebrow">CONSULTA Y REPORTES</div><h1>Historial</h1><p>Consulta movimientos y cobros registrados en el periodo.</p></div><button className="secondary-button" onClick={() => void refresh()} disabled={busy}>{busy ? "Actualizando…" : "Actualizar"}</button></div>
    {failure && <div className="history-error" role="alert"><div><strong>No se pudo cargar el historial</strong><p>{failure}</p></div><button className="primary-button" onClick={() => void refresh()} disabled={busy}>{busy ? "Reintentando…" : "Reintentar"}</button></div>}
    <section className="history-filters" aria-label="Filtros">
      <div className="history-presets" role="group" aria-label="Periodo rápido">{presets.map(([label, start, end]) => <button key={label} type="button" className={from === start && to === end ? "selected" : ""} onClick={() => { setFrom(start); setTo(end); }}>{label}</button>)}</div>
      <div className="history-filter-row"><label className="field"><span>Desde</span><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label className="field"><span>Hasta</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label><label className="field history-search"><span>Placa o ticket</span><div className="history-search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. ABC-123" /></div></label></div>
      <div className="history-presets" role="group" aria-label="Estado">{HISTORY_STATES.map(([value, label]) => <button key={value} type="button" className={state === value ? "selected" : ""} onClick={() => setState(value)}>{label}</button>)}</div>
    </section>
    <div className="summary-grid history-summary" aria-busy={busy}><SummaryCard icon={Activity} label="INGRESOS NETOS" value={ready ? currency(summary.revenue) : "—"} unit={ready ? `Efectivo ${currency(summary.cash)} · Yape ${currency(summary.yape)}` : "Sin datos del periodo"} accent="blue" /><SummaryCard icon={CarFront} label="TICKETS CERRADOS" value={ready ? String(summary.closedTickets) : "—"} unit={ready ? `${summary.voidedTickets} anulados · ${summary.openTickets} abiertos` : "Sin datos del periodo"} accent="violet" /><SummaryCard icon={Warehouse} label="OCUPACIÓN ACTUAL" value={ready ? `${occupied}/${capacity}` : "—"} unit={ready ? "espacios en uso ahora" : "Sin datos"} accent="green" /></div>
    <div className="users-table-wrap operation-table"><div className="users-table-head"><div><div className="eyebrow">MOVIMIENTOS</div><h2>Operaciones del periodo</h2></div><span className="count-pill">{records.length} {records.length === 1 ? "registro" : "registros"}{records.length >= 500 ? " · mostrando los 500 más recientes" : ""}</span></div>
      <div className="users-table"><div className="users-row history-row history-header"><span>TICKET / FECHA</span><span>VEHÍCULO</span><span>ESTADO / IMPORTE</span><span>OPERADORES</span></div>
        {records.map((record) => <div className="users-row history-row" key={record.code}><div className="ticket-code-cell"><strong>{record.code}</strong><small>{shortDateTime(record.enteredAt)}</small></div><div className="ticket-vehicle"><strong>{record.licensePlate}</strong><small>{record.vehicleType}</small></div><div className="history-state"><span className={`state-badge ${record.state.toLowerCase()}`}>{record.state === "CLOSED" ? "Cerrado" : record.state === "VOIDED" ? "Anulado" : "Abierto"}</span><small className="history-amount">{record.amount == null ? "Sin cobro" : currency(record.amount)}{record.paymentMethod ? ` · ${record.paymentMethod === "CASH" ? "Efectivo" : "Yape"}` : ""}</small></div><div className="ticket-code-cell"><strong>{record.processedBy ?? record.enteredBy}</strong><small>{record.exitedAt ? `Salida: ${shortDateTime(record.exitedAt)}` : `Ingreso: ${record.enteredBy}`}</small></div></div>)}
        {records.length === 0 && !failure && <div className="history-empty">{busy ? <p>Cargando movimientos…</p> : <><strong>{filtered ? "Ningún ticket coincide con estos filtros" : "Sin movimientos en este periodo"}</strong><p>{filtered ? "Prueba con otro estado o borra la búsqueda." : "Amplía el periodo para ver días anteriores."}</p><button className="secondary-button" onClick={() => { if (filtered) { setState("ALL"); setQuery(""); } else { setFrom(shiftDays(-6)); setTo(today); } }}>{filtered ? "Limpiar filtros" : "Ver últimos 7 días"}</button></>}</div>}
        {records.length === 0 && failure && <div className="history-empty"><p>No hay datos para mostrar.</p></div>}
      </div></div>
    {summary && <div className="occupancy-strip">{summary.occupancy.map((item) => <div className="occupancy-card" key={item.typeCode}><span>{item.typeName}</span><strong>{item.occupied}<small> / {item.capacity}</small></strong><div className="occupancy-meter"><i style={{ width: `${item.capacity ? Math.min(100, item.occupied / item.capacity * 100) : 0}%` }} /></div><small>{item.available} espacios disponibles ahora</small></div>)}</div>}
  </div>;
}

function Field({ label, name, type = "text", placeholder, required, minLength, autoComplete, defaultValue }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean; minLength?: number; autoComplete?: string; defaultValue?: string }) { return <label className="field"><span>{label}</span><input name={name} type={type} placeholder={placeholder} required={required} minLength={minLength} autoComplete={autoComplete} defaultValue={defaultValue} /></label>; }

type VehicleRow = { id: string; licensePlate: string; typeCode: string; typeName: string; state: string; openTicketCode: string | null; enteredAt: string | null };
type TicketRow = { id: string; code: string; licensePlate: string; typeCode: string; typeName: string; enteredAt: string; observation: string | null; state: string; enteredBy: string; capacity: number | null; occupied: number };

function OperationsPanel({ csrfHeaders, view, setView, onNotice, onPrint }: { csrfHeaders: () => Promise<Record<string, string>>; view: "tickets" | "vehicles"; setView: (view: "tickets" | "vehicles") => void; onNotice: (notice: Notice) => void; onPrint: (code: string) => void }) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<Array<{ code: string; name: string }>>([]);
  const [capacities, setCapacities] = useState<Array<{ typeCode: string; typeName: string; capacity: number; occupied: number }>>([]);
  const [entryType, setEntryType] = useState("");
  const entryFormRef = useRef<HTMLFormElement>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRow | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<"ALL" | "IN_LOT" | "ACTIVE" | "INACTIVE">("ALL");
  const [busy, setBusy] = useState(false);
  const [offlineEntries, setOfflineEntries] = useState<OfflineEntry[]>([]);
  const [online, setOnline] = useState(true);

  const refreshOfflineEntries = useCallback(async () => setOfflineEntries(await listOfflineEntries()), []);
  const syncOfflineEntries = useCallback(async () => {
    if (!navigator.onLine) return;
    const entries = await listOfflineEntries();
    for (const entry of entries) {
      if (entry.status === "CONFLICT") continue;
      try {
        const response = await fetch(`${API}/parking/tickets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...await csrfHeaders() },
          credentials: "include",
          body: JSON.stringify({ licensePlate: entry.licensePlate, typeCode: entry.typeCode, observation: entry.observation, clientOperationId: entry.operationId, offlineCreatedAt: entry.createdAt }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.ok) {
          await removeOfflineEntry(entry.operationId);
          onNotice({ type: "success", text: `Ingreso ${entry.code} sincronizado como ${body.code}.` });
        } else if (response.status >= 400 && response.status < 500) {
          await saveOfflineEntry({ ...entry, status: "CONFLICT", message: body.message ?? "El servidor rechazó este ingreso." });
        } else {
          await saveOfflineEntry({ ...entry, status: "ERROR", message: `Error del servidor (${response.status}); se reintentará al recuperar el servicio.` });
          break;
        }
      } catch {
        await saveOfflineEntry({ ...entry, status: "ERROR", message: "No se pudo contactar con la API; se reintentará al recuperar la conexión." });
        break;
      }
    }
    await refreshOfflineEntries();
  }, [csrfHeaders, onNotice, refreshOfflineEntries]);

  useEffect(() => {
    const updateConnectivity = () => { setOnline(navigator.onLine); if (navigator.onLine) void syncOfflineEntries(); };
    const timer = window.setTimeout(() => {
      setOnline(navigator.onLine);
      void refreshOfflineEntries().then(() => { if (navigator.onLine) void syncOfflineEntries(); });
    }, 0);
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", updateConnectivity); window.removeEventListener("offline", updateConnectivity); };
  }, [refreshOfflineEntries, syncOfflineEntries]);

  const refresh = useCallback(async () => {
    const [vehicleResponse, ticketResponse, typeResponse, occupancyResponse] = await Promise.all([
      fetch(`${API}/parking/vehicles?state=ALL&q=${encodeURIComponent(query)}`, { credentials: "include" }),
      fetch(`${API}/parking/tickets?state=ALL&q=${encodeURIComponent(query)}`, { credentials: "include" }),
      fetch(`${API}/parking/tickets/vehicle-types`, { credentials: "include" }),
      fetch(`${API}/parking/tickets/occupancy`, { credentials: "include" }),
    ]);
    if (!vehicleResponse.ok || !ticketResponse.ok || !typeResponse.ok || !occupancyResponse.ok) throw new Error("No se pudieron cargar vehículos, tickets y aforo.");
    const [vehicleRows, ticketRows, typeRows, occupancyRows] = await Promise.all([vehicleResponse.json(), ticketResponse.json(), typeResponse.json(), occupancyResponse.json()]) as [VehicleRow[], TicketRow[], Array<{ code: string; name: string }>, Array<{ typeCode: string; typeName: string; capacity: number; occupied: number }>];
    setVehicles(vehicleRows); setTickets(ticketRows);
    setTypes(typeRows); setCapacities(occupancyRows);
  }, [query]);

  useEffect(() => { const timer = window.setTimeout(() => { void refresh().catch((error) => { if (navigator.onLine) onNotice({ type: "error", text: error instanceof Error ? error.message : "Error al cargar operaciones." }); }); }, 0); return () => window.clearTimeout(timer); }, [refresh, view, onNotice]);

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const operationId = crypto.randomUUID();
      const localEntry = { operationId, licensePlate: String(data.licensePlate ?? "").trim().toUpperCase(), typeCode: String(data.typeCode ?? ""), observation: String(data.observation ?? "").trim() || null, createdAt: new Date().toISOString() };
      if (!navigator.onLine) {
        await queueEntry(localEntry);
        return;
      }
      let response: Response;
      try {
        response = await fetch(`${API}/parking/tickets`, { method: "POST", headers: { "Content-Type": "application/json", ...await csrfHeaders() }, credentials: "include", body: JSON.stringify({ ...data, clientOperationId: operationId }) });
      } catch (networkError) {
        if (networkError instanceof TypeError || (networkError instanceof Error && networkError.message.includes("sesión segura"))) {
          await queueEntry(localEntry);
          return;
        }
        throw networkError;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "No se pudo registrar el ingreso.");
      resetEntry(); onNotice({ type: "success", text: `Ingreso registrado. Código ${body.code}.` }); await refresh(); onPrint(body.code);
    }
    catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "Error al registrar ingreso." }); }
    finally { setBusy(false); }
  }

  function resetEntry() { entryFormRef.current?.reset(); setEntryType(""); entryFormRef.current?.querySelector<HTMLInputElement>("input[name=licensePlate]")?.focus(); }

  async function queueEntry(entry: Omit<OfflineEntry, "code" | "status">) {
    const occupied = capacities.find((capacity) => capacity.typeCode === entry.typeCode);
    const pendingForType = offlineEntries.filter((queued) => queued.typeCode === entry.typeCode && queued.status !== "CONFLICT").length;
    if (!occupied) throw new Error("No hay un aforo guardado en este equipo. Conéctate para cargar la configuración antes de registrar ingresos offline.");
    if (occupied.occupied + pendingForType >= occupied.capacity) {
      throw new Error("La capacidad disponible local parece completa. Conéctate para actualizar el aforo antes de guardar otro ingreso.");
    }
    const queued: OfflineEntry = { ...entry, code: `LOCAL-${entry.operationId.slice(0, 8).toUpperCase()}`, status: "PENDING" };
    await saveOfflineEntry(queued);
    await refreshOfflineEntries();
    resetEntry();
    onNotice({ type: "success", text: `Ingreso guardado en este equipo como ${queued.code}. Es provisional hasta sincronizarse.` });
  }

  async function retryEntry(entry: OfflineEntry) {
    await saveOfflineEntry({ ...entry, status: "PENDING", message: undefined });
    await refreshOfflineEntries();
    await syncOfflineEntries();
  }

  async function discardConflict(entry: OfflineEntry) {
    if (!window.confirm(`¿Descartar el ingreso provisional ${entry.code}?`)) return;
    await removeOfflineEntry(entry.operationId);
    await refreshOfflineEntries();
  }

  async function saveVehicle(data: { licensePlate: string; typeCode: string }, addAnother: boolean): Promise<boolean> {
    setBusy(true);
    try {
      const response = await fetch(`${API}/parking/vehicles${editing ? `/${editing.id}` : ""}`, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json", ...await csrfHeaders() }, credentials: "include", body: JSON.stringify(data) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "No se pudo guardar el vehículo.");
      if (!addAnother) { setVehicleOpen(false); setEditing(null); }
      onNotice(addAnother ? null : { type: "success", text: editing ? `Vehículo ${data.licensePlate} actualizado.` : `Vehículo ${data.licensePlate} registrado.` });
      await refresh();
      return true;
    } catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "Error al guardar vehículo." }); return false; }
    finally { setBusy(false); }
  }

  async function setVehicleState(vehicle: VehicleRow) {
    const next = vehicle.state === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try { const response = await fetch(`${API}/parking/vehicles/${vehicle.id}/state`, { method: "PATCH", headers: { "Content-Type": "application/json", ...await csrfHeaders() }, credentials: "include", body: JSON.stringify({ state: next }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "No se pudo cambiar el estado."); await refresh(); }
    catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "Error al cambiar estado." }); }
  }

  async function voidTicket(code: string) {
    const reason = window.prompt(`Motivo para anular el ticket ${code}:`); if (reason == null) return;
    try { const response = await fetch(`${API}/parking/tickets/${encodeURIComponent(code)}/void`, { method: "PUT", headers: { "Content-Type": "application/json", ...await csrfHeaders() }, credentials: "include", body: JSON.stringify({ reason }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "No se pudo anular el ticket."); onNotice({ type: "success", text: "Ticket anulado con motivo registrado." }); await refresh(); }
    catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "Error al anular ticket." }); }
  }

  const title = view === "tickets" ? "Tickets de ingreso" : "Vehículos";
  return <div className="operations-page">
    <div className="page-heading"><div><h1>{title}</h1><p>{view === "tickets" ? "Registra entradas y conserva cada ticket como historial operativo." : "Placas registradas y su estado. Un vehículo con ticket abierto no se puede editar ni desactivar."}</p></div>{view === "vehicles" && !vehicleOpen && <button className="primary-button" onClick={() => { setEditing(null); setVehicleOpen(true); }}><Plus size={17} />Crear vehículo</button>}</div>
    {view === "tickets" && (!online || offlineEntries.length > 0) && <section className={`offline-panel ${online ? "offline-panel-online" : ""}`}><div className="offline-panel-heading"><div><strong>{online ? "Conexión disponible" : "Sin conexión · modo temporal"}</strong><span>{offlineEntries.filter((entry) => entry.status !== "CONFLICT").length} pendientes · {offlineEntries.filter((entry) => entry.status === "CONFLICT").length} conflictos</span></div><button className="table-action" disabled={!online} onClick={() => void syncOfflineEntries()}>Sincronizar ahora</button></div>{!online && <p>Se guardan ingresos en este equipo. El código LOCAL es provisional; el ticket oficial se asigna al sincronizar. No registres salidas ni cobros desconectado.</p>}{offlineEntries.map((entry) => <div className="offline-entry" key={entry.operationId}><div><strong>{entry.code} · {entry.licensePlate}</strong><small>{new Date(entry.createdAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })} · {entry.status === "PENDING" ? "Pendiente de sincronización" : entry.message}</small></div>{entry.status !== "PENDING" && <div className="table-actions"><button className="table-action" disabled={!online} onClick={() => void retryEntry(entry)}>Reintentar</button><button className="table-action danger" onClick={() => void discardConflict(entry)}>Descartar</button></div>}</div>)}</section>}
    <div className="operation-toolbar"><div className="operation-tabs" role="tablist"><button role="tab" aria-selected={view === "tickets"} className={view === "tickets" ? "selected" : ""} onClick={() => setView("tickets")}>Tickets</button><button role="tab" aria-selected={view === "vehicles"} className={view === "vehicles" ? "selected" : ""} onClick={() => setView("vehicles")}>Vehículos</button></div><label className="operation-search"><Search size={17} /><input aria-label="Buscar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === "tickets" ? "Buscar por placa o código" : "Buscar por placa"} /></label></div>
    {view === "vehicles" && !vehicleOpen && <div className="occupancy-strip">{capacities.map((item) => { const pending = offlineEntries.filter((entry) => entry.typeCode === item.typeCode && entry.status !== "CONFLICT").length; const occupied = item.occupied + pending; return <div className="occupancy-card" key={item.typeCode}><span>{item.typeName}</span><strong>{occupied} <small>/ {item.capacity}</small></strong><div className="occupancy-meter"><i style={{ width: `${item.capacity ? Math.min(100, occupied / item.capacity * 100) : 0}%` }} /></div><small>{Math.max(0, item.capacity - occupied)} espacios disponibles{pending > 0 ? ` · ${pending} local(es)` : ""}</small></div>; })}</div>}
    {view === "tickets" ? <>
      {view === "tickets" && <form ref={entryFormRef} className="entry-desk" onSubmit={createEntry} aria-label="Registrar ingreso">
        <label className="entry-plate"><span>Placa</span><input name="licensePlate" placeholder="ABC-123" required autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={10} /></label>
        <fieldset className="entry-types"><legend>Tipo de vehículo</legend>{types.map((type) => { const cap = capacities.find((item) => item.typeCode === type.code); const pending = offlineEntries.filter((entry) => entry.typeCode === type.code && entry.status !== "CONFLICT").length; const occupied = (cap?.occupied ?? 0) + pending; const free = cap ? Math.max(0, cap.capacity - occupied) : null; const full = free === 0; return <label key={type.code} className={`entry-type ${entryType === type.code ? "selected" : ""} ${full ? "full" : ""}`}><input type="radio" name="typeCode" value={type.code} required checked={entryType === type.code} disabled={full} onChange={() => setEntryType(type.code)} /><strong>{type.name}</strong><span>{full ? "Completo" : free == null ? "—" : `${free} libres`}</span><i className="occupancy-meter" aria-hidden="true"><b style={{ width: `${cap?.capacity ? Math.min(100, occupied / cap.capacity * 100) : 0}%` }} /></i></label>; })}</fieldset>
        <label className="entry-note"><span>Observación <em>(opcional)</em></span><input name="observation" maxLength={500} placeholder="Ej. golpe en el parachoques" /></label>
        <button className="primary-button entry-submit" disabled={busy}>{busy ? "Registrando…" : <>Registrar ingreso<kbd>↵</kbd></>}</button>
      </form>}
      <div className="users-table-wrap operation-table"><div className="users-table-head"><div><div className="eyebrow">REGISTRO DE INGRESOS</div><h2>Tickets</h2></div><span className="count-pill">{tickets.length} registros</span></div><div className="users-table"><div className="users-row ticket-row ticket-header"><span>TICKET / HORA</span><span>VEHÍCULO</span><span>ESTADO</span><span>ACCIONES</span></div>{tickets.map((ticket) => <div className="users-row ticket-row" key={ticket.id}><div className="ticket-code-cell"><strong>{ticket.code}</strong><small>{new Date(ticket.enteredAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</small></div><div className="ticket-vehicle"><strong>{ticket.licensePlate}</strong><small>{ticket.typeName} · {ticket.enteredBy}</small></div><span><i className={`status-dot ${ticket.state === "OPEN" ? "" : "status-muted"}`} /> {ticket.state === "OPEN" ? "Abierto" : ticket.state === "CLOSED" ? "Cerrado" : "Anulado"}</span><div className="table-actions"><button className="table-action" onClick={() => onPrint(ticket.code)}><Printer size={14} /> Imprimir</button>{ticket.state === "OPEN" && <button className="table-action danger" onClick={() => voidTicket(ticket.code)}><Ban size={14} /> Anular</button>}</div></div>)}{tickets.length === 0 && <div className="users-empty">Aún no hay tickets. Escribe una placa y elige el tipo de vehículo arriba para registrar el primer ingreso.</div>}</div></div>
    </> : <>
      {vehicleOpen && <VehicleForm key={editing?.id ?? "new"} editing={editing} types={types} vehicles={vehicles} busy={busy} onSave={saveVehicle} onCancel={() => { setVehicleOpen(false); setEditing(null); onNotice(null); }} onShowExisting={(plate) => { setQuery(plate); setVehicleFilter("ALL"); setVehicleOpen(false); setEditing(null); }} />}
      <VehicleCatalog formOpen={vehicleOpen} vehicles={vehicles} query={query} filter={vehicleFilter} setFilter={setVehicleFilter} onCreate={() => { setEditing(null); setVehicleOpen(true); }} onClearSearch={() => setQuery("")} onEdit={(vehicle) => { setEditing(vehicle); setVehicleOpen(true); }} onToggle={(vehicle) => void setVehicleState(vehicle)} />
    </>}
  </div>;
}

const vehicleTypeIcon = (code: string) => vehicleIcons[code] ?? CarFront;

const normalizePlate = (value: string) => value.normalize("NFD").replace(/\p{M}+/gu, "").toUpperCase().replace(/\s+/g, "");
const PLATE_PATTERN = /^[A-Z0-9-]{5,12}$/;

function VehicleForm({ editing, types, vehicles, busy, onSave, onCancel, onShowExisting }: { editing: VehicleRow | null; types: Array<{ code: string; name: string }>; vehicles: VehicleRow[]; busy: boolean; onSave: (data: { licensePlate: string; typeCode: string }, addAnother: boolean) => Promise<boolean>; onCancel: () => void; onShowExisting: (plate: string) => void }) {
  const [plate, setPlate] = useState(editing?.licensePlate ?? "");
  const [typeCode, setTypeCode] = useState(editing?.typeCode ?? "");
  const [touched, setTouched] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const plateRef = useRef<HTMLInputElement>(null);

  useEffect(() => { formRef.current?.scrollIntoView({ block: "nearest" }); }, []);

  const duplicate = plate ? vehicles.find((vehicle) => vehicle.licensePlate === plate && vehicle.id !== editing?.id) : undefined;
  const badChars = /[^A-Z0-9-]/.test(plate);
  const tooShort = plate.length > 0 && plate.length < 5;
  const problem = duplicate ? "duplicate" : badChars ? "chars" : tooShort && touched ? "short" : null;
  const valid = PLATE_PATTERN.test(plate) && !duplicate && Boolean(typeCode);
  const missing = !plate ? "Escribe la placa" : !PLATE_PATTERN.test(plate) ? "Completa la placa" : duplicate ? "Placa ya registrada" : !typeCode ? "Elige el tipo de vehículo" : null;

  async function submit(addAnother: boolean) {
    setTouched(true);
    if (!valid || busy) return;
    const saved = plate;
    if (await onSave({ licensePlate: plate, typeCode }, addAnother)) {
      if (addAnother) { setJustSaved(saved); setPlate(""); setTouched(false); plateRef.current?.focus(); }
    }
  }

  const hintId = "vehicle-plate-hint";
  return <form ref={formRef} className="vehicle-form" aria-label={editing ? "Editar vehículo" : "Nuevo vehículo"} noValidate
    onSubmit={(event) => { event.preventDefault(); void submit(false); }}
    onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }}>
    <div className="vehicle-form-head">
      <h2>{editing ? "Editar vehículo" : "Nuevo vehículo"}</h2>
      <button type="button" className="icon-button" onClick={onCancel} aria-label="Cerrar formulario"><X size={18} /></button>
    </div>
    <div className="vehicle-form-body">
      <label className="vehicle-plate-field">
        <span>Placa</span>
        <input ref={plateRef} name="licensePlate" value={plate} onChange={(event) => { setPlate(normalizePlate(event.target.value)); setJustSaved(null); }} onBlur={() => setTouched(true)}
          placeholder="ABC-123" autoFocus required maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false}
          aria-invalid={problem ? true : undefined} aria-describedby={hintId} />
      </label>
      <fieldset className="vehicle-type-field">
        <legend>Tipo de vehículo</legend>
        <div className="vehicle-type-options">{types.map((type) => { const Icon = vehicleTypeIcon(type.code); return <label key={type.code} className={`vehicle-type-option ${typeCode === type.code ? "selected" : ""}`}><input type="radio" name="typeCode" value={type.code} checked={typeCode === type.code} onChange={() => setTypeCode(type.code)} /><Icon size={20} aria-hidden /><strong>{type.name}</strong></label>; })}</div>
      </fieldset>
    </div>
    <p id={hintId} className={`vehicle-hint ${problem ? "is-error" : justSaved ? "is-ok" : ""}`} role={problem || justSaved ? "status" : undefined}>
      {duplicate ? <>La placa <b>{plate}</b> ya está registrada como {duplicate.typeName.toLowerCase()}{duplicate.state === "ACTIVE" ? "" : " (inactiva)"}. <button type="button" className="table-action" onClick={() => onShowExisting(plate)}>Ver en la lista</button></>
        : badChars ? "Solo letras, números y guion. Quita los símbolos."
        : problem === "short" ? "La placa necesita al menos 5 caracteres."
        : justSaved ? <><b>{justSaved}</b> registrada. Sigue con la siguiente placa.</>
        : "5 a 12 caracteres. Se guarda en mayúsculas y sin espacios."}
    </p>
    <div className="vehicle-form-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
      <span className="vehicle-form-spacer" />
      {!editing && <button type="button" className="secondary-button" disabled={busy || !valid} onClick={() => void submit(true)}>Guardar y registrar otro</button>}
      <button className="primary-button" disabled={busy || !valid}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "Registrar vehículo"}</button>
    </div>
    {missing && !busy && <p className="vehicle-missing" aria-live="polite">{missing} para continuar.</p>}
  </form>;
}

function VehicleCatalog({ formOpen, vehicles, query, filter, setFilter, onCreate, onClearSearch, onEdit, onToggle }: { formOpen: boolean; vehicles: VehicleRow[]; query: string; filter: "ALL" | "IN_LOT" | "ACTIVE" | "INACTIVE"; setFilter: (filter: "ALL" | "IN_LOT" | "ACTIVE" | "INACTIVE") => void; onCreate: () => void; onClearSearch: () => void; onEdit: (vehicle: VehicleRow) => void; onToggle: (vehicle: VehicleRow) => void }) {
  const counts = { ALL: vehicles.length, IN_LOT: vehicles.filter((v) => v.openTicketCode).length, ACTIVE: vehicles.filter((v) => v.state === "ACTIVE").length, INACTIVE: vehicles.filter((v) => v.state !== "ACTIVE").length };
  const filters: Array<[typeof filter, string]> = [["ALL", "Todos"], ["IN_LOT", "En la playa"], ["ACTIVE", "Activos"], ["INACTIVE", "Inactivos"]];
  const visible = vehicles.filter((v) => filter === "ALL" || (filter === "IN_LOT" ? Boolean(v.openTicketCode) : filter === "ACTIVE" ? v.state === "ACTIVE" : v.state !== "ACTIVE"));
  return <div className="users-table-wrap operation-table vehicle-catalog">
    <div className="catalog-head"><div className="filter-chips" role="group" aria-label="Filtrar vehículos">{filters.map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} className={filter === key ? "selected" : ""} onClick={() => setFilter(key)}>{label}<span>{counts[key]}</span></button>)}</div></div>
    {visible.length > 0 && <div className="users-table"><div className="users-row vehicle-row vehicle-header"><span>PLACA</span><span>TIPO</span><span>ESTADO</span><span>ACCIONES</span></div>
      {visible.map((vehicle) => { const Icon = vehicleTypeIcon(vehicle.typeCode); const inLot = Boolean(vehicle.openTicketCode); const active = vehicle.state === "ACTIVE"; return <div className={`users-row vehicle-row ${active ? "" : "vehicle-inactive"}`} key={vehicle.id}>
        <div className="plate-cell"><span className="plate">{vehicle.licensePlate}</span></div>
        <span className="vehicle-type-cell"><Icon size={16} aria-hidden /> {vehicle.typeName}</span>
        <span>{inLot ? <span className="state-pill in-lot"><i className="status-dot" /> En la playa<small>{vehicle.openTicketCode}</small></span> : active ? <span className="state-pill">Activo</span> : <span className="state-pill off">Inactivo</span>}</span>
        <div className="table-actions"><button className="row-action" disabled={inLot || !active} title={inLot ? "Tiene un ticket abierto; ciérralo para editar." : !active ? "Activa el vehículo para editarlo." : undefined} onClick={() => onEdit(vehicle)}><Pencil size={14} /> Editar</button><button className="row-action" disabled={inLot} title={inLot ? "Tiene un ticket abierto; ciérralo para cambiar su estado." : undefined} onClick={() => onToggle(vehicle)}>{active ? "Desactivar" : "Activar"}</button></div>
      </div>; })}</div>}
    {visible.length === 0 && <div className="catalog-empty">{vehicles.length === 0 && !query ? <><div className="catalog-empty-icon"><CarFront size={22} aria-hidden /></div><h3>Aún no hay vehículos registrados</h3><p>Registra una placa para asignarle un tipo y reutilizarla en cada ingreso. También se crean solos al emitir un ticket.</p>{!formOpen && <button className="primary-button" onClick={onCreate}><Plus size={17} /> Crear vehículo</button>}</> : query ? <><div className="catalog-empty-icon"><Search size={22} aria-hidden /></div><h3>Sin resultados para “{query}”</h3><p>Revisa la placa o prueba con menos caracteres.</p><button className="secondary-button" onClick={onClearSearch}>Limpiar búsqueda</button></> : <><div className="catalog-empty-icon"><CarFront size={22} aria-hidden /></div><h3>Ningún vehículo en este filtro</h3><p>Cambia el filtro para ver el resto del catálogo.</p><button className="secondary-button" onClick={() => setFilter("ALL")}>Ver todos</button></>}</div>}
  </div>;
}

type ExitQuote = { ticketId: string; ticketCode: string; licensePlate: string; vehicleType: string; enteredAt: string; exitedAt: string; elapsedMinutes: number; billedMinutes: number; billingIncrementMinutes: number; amount: number; breakdown: Record<string, number> };

type OpenTicket = { id: string; code: string; licensePlate: string; typeName: string; enteredAt: string };

function formatElapsed(from: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

function ExitPanel({ csrfHeaders, onNotice }: { csrfHeaders: () => Promise<Record<string, string>>; onNotice: (notice: Notice) => void }) {
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<ExitQuote | null>(null);
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<OpenTicket[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);

  const loadOpen = useCallback(async () => {
    try {
      const response = await fetch(`${API}/parking/tickets?state=OPEN&q=`, { credentials: "include", cache: "no-store" });
      if (response.ok) setOpen(await response.json());
    } catch { /* lista opcional: la búsqueda manual sigue disponible */ }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadOpen(), 0); return () => window.clearTimeout(timer); }, [loadOpen]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const timer = window.setTimeout(update, 0); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const term = code.trim().toUpperCase().replace(/[\s-]/g, "");
  const matches = (open ?? []).filter((ticket) => !term || ticket.licensePlate.toUpperCase().replace(/[\s-]/g, "").includes(term) || ticket.code.toUpperCase().replace(/[\s-]/g, "").includes(term));

  async function calculate(identifier: string) {
    setBusy(true); setQuote(null); onNotice(null);
    try { const response = await fetch(`${API}/parking/tickets/${encodeURIComponent(identifier.trim())}/quote`, { credentials: "include", cache: "no-store" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "No se pudo calcular la salida."); setQuote(body); setMethod("CASH"); setReference(""); }
    catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "No se pudo calcular la salida." }); }
    finally { setBusy(false); }
  }
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void calculate(matches.length === 1 ? matches[0].code : code);
  }
  function reset() { setQuote(null); setCode(""); setReference(""); onNotice(null); }
  async function close() {
    if (!quote) return; setBusy(true); onNotice(null);
    try { const response = await fetch(`${API}/parking/tickets/${encodeURIComponent(quote.ticketCode)}/close`, { method: "PUT", headers: { "Content-Type": "application/json", ...await csrfHeaders() }, credentials: "include", body: JSON.stringify({ method, reference: reference || null, confirmedAmount: quote.amount }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "No se pudo confirmar el cobro."); onNotice({ type: "success", text: `Salida registrada · ${quote.licensePlate}. Cobro ${currency(body.amount)} por ${method === "CASH" ? "efectivo" : "Yape"}.` }); reset(); void loadOpen(); }
    catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "No se pudo confirmar el cobro." }); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">CIERRE DE OPERACIÓN</div><h1>Registrar salida</h1><p>Elige el vehículo, revisa el desglose y confirma el pago.</p></div></div>
    {!online && <div className="exit-offline" role="alert"><strong>Sin conexión.</strong> Las salidas y cobros requieren conexión: el importe no se puede calcular de forma segura sin el servidor.</div>}
    <div className="exit-layout">
      <section className="exit-pick">
        <form className="exit-search" onSubmit={preview}>
          <label className="field"><span>Placa o código de ticket</span><div className="exit-search-box"><Search size={16} /><input autoFocus value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); if (quote) setQuote(null); }} placeholder="ABC-123 o PF-…" autoComplete="off" spellCheck={false} /></div></label>
        </form>
        <div className="exit-list-head"><span className="eyebrow">EN EL ESTACIONAMIENTO</span><span className="count-pill">{open == null ? "Cargando…" : term ? `${matches.length} de ${open.length}` : `${open.length} ${open.length === 1 ? "vehículo" : "vehículos"}`}</span></div>
        <div className="exit-list" role="list">
          {matches.map((ticket) => <button type="button" role="listitem" key={ticket.id} className={`exit-row ${quote?.ticketCode === ticket.code ? "selected" : ""}`} disabled={busy || !online} onClick={() => { setCode(ticket.licensePlate); void calculate(ticket.code); }}>
            <span className="exit-plate">{ticket.licensePlate}</span>
            <span className="exit-meta"><strong>{ticket.typeName}</strong><small>{ticket.code}</small></span>
            <span className="exit-time"><Clock3 size={13} />{formatElapsed(ticket.enteredAt, now)}</span>
            <span className="exit-go">Cobrar <ArrowUpRight size={14} /></span>
          </button>)}
          {open != null && matches.length === 0 && <div className="users-empty">{open.length === 0 ? "No hay vehículos dentro en este momento." : <>Ningún vehículo coincide con “{code.trim()}”. Presiona Enter para buscarlo por ticket o placa completa.</>}</div>}
        </div>
      </section>
      <aside className="exit-checkout" aria-live="polite">
        {!quote ? <div className="exit-placeholder"><ArrowUpRight size={22} /><strong>Selecciona un vehículo</strong><p>Aquí verás el tiempo, el desglose y el total a cobrar.</p></div> : <section className="exit-quote">
          <div className="exit-quote-head"><div><div className="eyebrow">TICKET {quote.ticketCode}</div><h2>{quote.licensePlate}</h2><p>{quote.vehicleType} · Ingreso {new Date(quote.enteredAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</p></div><button type="button" className="table-action" onClick={reset}>Cambiar</button></div>
          <div className="quote-time"><Clock3 size={15} /><span><strong>{formatElapsed(quote.enteredAt, new Date(quote.exitedAt).getTime())}</strong> transcurridos · cobro por tramos de {quote.billingIncrementMinutes} min</span></div>
          <div className="quote-breakdown">{Object.entries(quote.breakdown).map(([label, amount]) => <div key={label}><span>{label}</span><strong>{currency(amount)}</strong></div>)}</div>
          <div className="quote-total-big"><span>Total a cobrar</span><strong>{currency(quote.amount)}</strong></div>
          <div className="field"><span>Medio de pago</span><div className="method-toggle" role="radiogroup" aria-label="Medio de pago">{[["CASH", "Efectivo"], ["YAPE", "Yape"]].map(([value, label]) => <button type="button" role="radio" aria-checked={method === value} className={method === value ? "selected" : ""} key={value} onClick={() => setMethod(value)}>{label}</button>)}</div></div>
          {method === "YAPE" && <label className="field"><span>Referencia (opcional)</span><input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} placeholder="Código de operación" /></label>}
          <button className="primary-button exit-confirm" disabled={busy || !online} onClick={() => void close()}>{busy ? "Procesando…" : `Confirmar ${currency(quote.amount)} y registrar salida`}</button>
        </section>}
      </aside>
    </div>
  </>;
}

function TicketPrint({ code, onClose }: { code: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<Record<string, string> | null>(null);
  useEffect(() => { let cancelled = false; void fetch(`${API}/parking/tickets/${encodeURIComponent(code)}`, { credentials: "include" }).then((response) => response.json()).then((data) => { if (!cancelled) setTicket(data); }).catch(() => undefined); return () => { cancelled = true; }; }, [code]);
  return <div className="print-overlay"><div className="print-actions"><button className="secondary-button" onClick={onClose}><X size={16} /> Cerrar</button><button className="primary-button" onClick={() => window.print()}><Printer size={16} /> Imprimir ticket</button></div><article className="print-ticket"><div className="print-brand">PARKFLOW<span>.</span></div><div className="eyebrow">TICKET DE INGRESO</div><div className="print-code">{ticket?.code ?? code}</div><div className="print-identifier-label">IDENTIFICADOR DE BÚSQUEDA</div><dl><dt>PLACA</dt><dd>{ticket?.licensePlate ?? "Cargando…"}</dd><dt>VEHÍCULO</dt><dd>{ticket?.typeName ?? ""}</dd><dt>FECHA Y HORA</dt><dd>{ticket?.enteredAt ? new Date(ticket.enteredAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }) : ""}</dd></dl><p>Conserve este ticket para registrar la salida.</p></article></div>;
}

type OccupancyRow = { typeCode: string; typeName: string; capacity: number; occupied: number; available?: number };

function greeting() { const hour = new Date().getHours(); return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches"; }

function Overview({ user, configuration, onConfigure, onGo }: { user: User | null; configuration: Configuration | null; onConfigure: () => void; onGo: (target: "entry" | "exit") => void }) {
  const [occupancy, setOccupancy] = useState<OccupancyRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API}/parking/tickets/occupancy`, { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error();
        const rows = await response.json() as OccupancyRow[];
        if (active) { setOccupancy(rows); setFailed(false); setUpdatedAt(new Date()); }
      } catch { if (active) setFailed(true); }
    };
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const vehicleTypes = configuration?.vehicleTypes ?? [];
  const configured = vehicleTypes.filter((type) => type.capacity != null && type.hourlyAmount != null).length;
  const allConfigured = configured === vehicleTypes.length && configured > 0;
  const rows = occupancy ?? [];
  const totalCapacity = rows.reduce((total, item) => total + item.capacity, 0);
  const totalOccupied = rows.reduce((total, item) => total + item.occupied, 0);
  const totalFree = Math.max(0, totalCapacity - totalOccupied);
  const level = (item: { capacity: number; occupied: number }) => item.capacity > 0 && item.occupied >= item.capacity ? "full" : item.capacity > 0 && item.occupied / item.capacity >= 0.8 ? "high" : "ok";
  const fullTypes = rows.filter((item) => level(item) === "full").map((item) => item.typeName);
  return <>
    <div className="page-heading"><div><div className="eyebrow">{new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</div><h1>{greeting()}, {user?.firstName ?? "equipo"}.</h1><p>{occupancy ? `Hay ${totalFree} de ${totalCapacity} espacios libres en este momento.` : failed ? "No pudimos cargar el aforo en vivo." : "Cargando el aforo en vivo…"}</p></div>
      <div className="quick-actions"><button className="primary-button" onClick={() => onGo("entry")}><ArrowDownRight size={17} /> Registrar ingreso</button><button className="secondary-button" onClick={() => onGo("exit")}><ArrowUpRight size={17} /> Registrar salida</button></div></div>
    {failed && <div className="notice notice-error" role="alert"><span>No se pudo actualizar el aforo. Reintentaremos en unos segundos.</span></div>}
    {fullTypes.length > 0 && <div className="notice notice-warning" role="status"><span><strong>Sin espacios libres:</strong> {fullTypes.join(", ")}. Avisa en garita antes de aceptar más vehículos.</span></div>}
    <div className="section-title-row live-title"><div><div className="eyebrow">AFORO EN VIVO</div><h2>Ocupación por tipo de vehículo</h2></div><span className="readiness">{updatedAt ? `Actualizado ${new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(updatedAt)}` : ""}</span></div>
    <div className="live-grid">
      <article className={`live-total ${level({ capacity: totalCapacity, occupied: totalOccupied })}`}><div className="eyebrow">TOTAL OCUPADO</div><div className="live-total-value">{occupancy ? totalOccupied : "—"}<small> / {occupancy ? totalCapacity : "—"}</small></div><div className="occupancy-meter" role="progressbar" aria-label="Ocupación total" aria-valuemin={0} aria-valuemax={totalCapacity} aria-valuenow={totalOccupied}><i style={{ width: `${totalCapacity ? Math.min(100, totalOccupied / totalCapacity * 100) : 0}%` }} /></div><p>{totalCapacity ? `${Math.round(totalOccupied / totalCapacity * 100)}% de la capacidad en uso` : "Define la capacidad para ver el aforo."}</p></article>
      {rows.map((item) => { const Icon = vehicleIcons[item.typeCode] ?? CarFront; const state = level(item); const free = Math.max(0, item.capacity - item.occupied); const rate = vehicleTypes.find((type) => type.code === item.typeCode)?.hourlyAmount ?? null; return <article className={`live-card ${state}`} key={item.typeCode}><div className="live-card-head"><div className={`vehicle-icon ${item.typeCode.toLowerCase()}`}><Icon size={19} /></div><strong>{item.typeName}</strong><span className={`live-badge ${state}`}>{state === "full" ? "Lleno" : state === "high" ? "Casi lleno" : "Disponible"}</span></div><div className="live-free"><span>{free}</span> libres</div><div className="occupancy-meter" role="progressbar" aria-label={`Ocupación de ${item.typeName}`} aria-valuemin={0} aria-valuemax={item.capacity} aria-valuenow={item.occupied}><i style={{ width: `${item.capacity ? Math.min(100, item.occupied / item.capacity * 100) : 0}%` }} /></div><div className="live-foot"><span>{item.occupied} de {item.capacity} ocupados</span><span>{currency(rate)} / hora</span></div></article>; })}
    </div>
    <div className="config-strip"><span className={`status-dot ${allConfigured ? "" : "status-amber"}`} /><p>{allConfigured ? `${configured} tipos de vehículo configurados con capacidad y tarifa.` : "Faltan tipos de vehículo por configurar (capacidad o tarifa)."}</p>{user?.role === "ADMIN" && <button className="secondary-button" onClick={onConfigure}><Settings2 size={16} /> Configurar</button>}</div>
  </>;
}

function SummaryCard({ label, value, unit, icon: Icon, accent }: { label: string; value: string; unit: string; icon: typeof Warehouse; accent: string }) { return <article className="summary-card"><div className={`summary-icon ${accent}`}><Icon size={18} /></div><div className="eyebrow">{label}</div><div className="summary-value">{value}</div><div className="summary-unit">{unit}</div><span className="summary-decoration" /></article>; }

function Settings({ configuration, busy, onSubmit }: { configuration: Configuration; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">ADMINISTRACIÓN</div><h1>Configuración</h1><p>Datos de la sede, aforo y tarifas. Se aplican a los nuevos cobros desde que guardas.</p></div></div>
      <form className="settings-form" onSubmit={onSubmit} onChange={() => setDirty(true)}>
        <section className="settings-panel">
          <div className="settings-panel-heading"><div className="settings-panel-icon"><Warehouse size={18} /></div><div><h2>Estacionamiento</h2><p>Información de la sede de operación.</p></div></div>
          <div className="field-row">
            <Field label="Nombre del estacionamiento" name="siteName" placeholder="Ej. Estacionamiento principal" defaultValue={configuration.site.name} required />
            <Field label="Dirección" name="address" placeholder="Ej. Av. Larco 345, Miraflores" defaultValue={configuration.site.address} required />
          </div>
          <div className="timezone-row"><Clock3 size={16} /><span>Zona horaria de los cobros</span><strong>America/Lima (UTC−5)</strong></div>
        </section>
        <section className="settings-panel">
          <div className="settings-panel-heading"><div className="settings-panel-icon violet"><CarFront size={18} /></div><div><h2>Capacidad y tarifas</h2><p>Define cuántos espacios hay y cómo se cobra cada tipo de vehículo.</p></div></div>
          <div className="vehicle-settings-list">{configuration.vehicleTypes.map((type) => <VehicleSettings key={type.id} type={type} />)}</div>
        </section>
        <div className={`settings-actions ${dirty ? "is-dirty" : ""}`} role="status">
          <span className="settings-state">{dirty ? <><span className="status-dot status-amber" /> Tienes cambios sin guardar</> : <><span className="status-dot" /> Todo guardado</>}</span>
          <button className="primary-button" disabled={busy || !dirty}>{busy ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </form>
    </>
  );
}

function VehicleSettings({ type }: { type: VehicleType }) {
  const Icon = vehicleIcons[type.code] ?? CarFront;
  const [night, setNight] = useState(Boolean(type.nightPeriodName));
  const n = (suffix: string) => `${type.code}-${suffix}`;
  return (
    <fieldset className="vehicle-settings">
      <legend className="vehicle-settings-title"><span className={`vehicle-icon ${type.code.toLowerCase()}`}><Icon size={18} /></span><strong>{type.name}</strong></legend>
      <div className="settings-groups">
        <div className="settings-group">
          <h3>Capacidad</h3>
          <label className="field"><span>Espacios disponibles</span><div className="input-suffix"><input name={n("capacity")} type="number" inputMode="numeric" min="0" step="1" defaultValue={type.capacity ?? ""} placeholder="0" required /><span>espacios</span></div></label>
        </div>
        <div className="settings-group">
          <h3>Tarifa</h3>
          <label className="field"><span>Precio por hora</span><div className="input-prefix"><span>S/</span><input name={n("hourlyAmount")} type="number" inputMode="decimal" min="0" step="0.50" defaultValue={type.hourlyAmount ?? ""} placeholder="0.00" required /></div></label>
        </div>
        <div className="settings-group">
          <h3>Cobro</h3>
          <div className="settings-pair">
            <label className="field"><span>Tolerancia</span><div className="input-suffix"><input name={n("graceMinutes")} type="number" inputMode="numeric" min="0" step="1" defaultValue={type.graceMinutes ?? 0} required /><span>min</span></div><small>Minutos gratis al ingresar</small></label>
            <label className="field"><span>Cobrar cada</span><div className="input-suffix"><input name={n("billingIncrementMinutes")} type="number" inputMode="numeric" min="1" max="1440" step="1" defaultValue={type.billingIncrementMinutes ?? 60} required /><span>min</span></div><small>Fracción mínima de cobro</small></label>
          </div>
        </div>
      </div>
      <div className={`night-config ${night ? "is-on" : ""}`}>
        <label className="night-toggle"><input type="checkbox" checked={night} onChange={(event) => setNight(event.target.checked)} /><span className="night-switch" aria-hidden="true" /><span><strong>Tarifa nocturna</strong><small>{night ? "Reemplaza la tarifa por hora dentro de esta franja." : "Usa un precio distinto en un horario de la noche."}</small></span></label>
        {night && <div className="settings-fields night-fields">
          <label className="field"><span>Nombre de la franja</span><input name={n("nightName")} defaultValue={type.nightPeriodName ?? ""} placeholder="Noche" required /></label>
          <label className="field"><span>Desde</span><input name={n("nightStart")} type="time" defaultValue={type.nightStartsAt?.slice(0, 5) ?? ""} required /></label>
          <label className="field"><span>Hasta</span><input name={n("nightEnd")} type="time" defaultValue={type.nightEndsAt?.slice(0, 5) ?? ""} required /></label>
          <label className="field"><span>Precio por hora</span><div className="input-prefix"><span>S/</span><input name={n("nightAmount")} type="number" inputMode="decimal" min="0" step="0.50" defaultValue={type.nightHourlyAmount ?? ""} placeholder="0.00" required /></div></label>
        </div>}
      </div>
    </fieldset>
  );
}

function UsersPanel({ apiBase, csrfHeaders, onLoad, onNotice }: { apiBase: string; csrfHeaders: () => Promise<Record<string, string>>; onLoad: () => Promise<Array<{ id: string; firstName: string; lastName: string; email: string; role: string; state: string }>>; onNotice: (notice: Notice) => void }) {
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; role: string; state: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void onLoad().then(setUsers).catch((error) => onNotice({ type: "error", text: error instanceof Error ? error.message : "No se pudo cargar la lista de usuarios." }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onLoad, onNotice]);
  async function refresh() { try { setUsers(await onLoad()); } catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "No se pudo cargar la lista de usuarios." }); } }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const form = event.currentTarget;
    try { const response = await fetch(`${apiBase}/admin/configuration/users`, { method: "POST", headers: { "Content-Type": "application/json", ...await csrfHeaders() }, credentials: "include", body: JSON.stringify(data) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "No se pudo crear la cuenta."); setCreateOpen(false); form.reset(); onNotice({ type: "success", text: "Cuenta de usuario creada." }); refresh(); }
    catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "Ocurrió un error." }); }
    finally { setBusy(false); }
  }
  async function toggle(userId: string, state: string) {
    const next = state === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try { const response = await fetch(`${apiBase}/admin/configuration/users/${userId}/state`, { method: "PATCH", headers: { "Content-Type": "application/json", ...await csrfHeaders() }, credentials: "include", body: JSON.stringify({ state: next }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "No se pudo cambiar el estado."); onNotice({ type: "success", text: `Cuenta ${next === "ACTIVE" ? "activada" : "desactivada"}.` }); refresh(); }
    catch (error) { onNotice({ type: "error", text: error instanceof Error ? error.message : "Ocurrió un error." }); }
  }
  return <><div className="page-heading"><div><div className="eyebrow">ADMINISTRACIÓN</div><h1>Usuarios</h1><p>Administra las cuentas que pueden operar ParkFlow.</p></div><button className="primary-button" onClick={() => setCreateOpen(!createOpen)}><Users size={17} /> {createOpen ? "Cancelar" : "Crear usuario"}</button></div>{createOpen && <form className="settings-panel user-create-form" onSubmit={create}><div className="field-row"><Field label="Nombre" name="firstName" placeholder="Nombre" required /><Field label="Apellido" name="lastName" placeholder="Apellido" required /></div><div className="field-row"><Field label="Correo electrónico" name="email" type="email" placeholder="persona@estacionamiento.pe" required /><Field label="Contraseña temporal" name="password" type="password" minLength={12} placeholder="Mínimo 12 caracteres" required /></div><label className="field role-field"><span>Rol asignado</span><select name="role" defaultValue="WORKER"><option value="WORKER">Trabajador</option><option value="ADMIN">Administrador</option></select></label><div className="settings-actions"><span>La contraseña se guardará cifrada.</span><button className="primary-button" disabled={busy}>{busy ? "Creando…" : "Crear cuenta"}<span>↗</span></button></div></form>}<div className="users-table-wrap"><div className="users-table-head"><div><div className="eyebrow">ACCESOS REGISTRADOS</div><h2>Equipo de estacionamiento</h2></div><span className="count-pill">{users.length} {users.length === 1 ? "usuario" : "usuarios"}</span></div><div className="users-table"><div className="users-row users-header"><span>PERSONA</span><span>ROL</span><span>ESTADO</span><span>ACCESO</span></div>{users.map((item) => <div className="users-row" key={item.id}><div className="user-cell"><div className="avatar">{item.firstName.slice(0,1)}{item.lastName.slice(0,1)}</div><div><strong>{item.firstName} {item.lastName}</strong><small>{item.email}</small></div></div><span className={`role-badge ${item.role.toLowerCase()}`}>{item.role === "ADMIN" ? "Administrador" : "Trabajador"}</span><span><i className={`status-dot ${item.state === "ACTIVE" ? "" : "status-muted"}`} /> {item.state === "ACTIVE" ? "Activo" : "Inactivo"}</span><button className="table-action" onClick={() => void toggle(item.id, item.state)}>{item.state === "ACTIVE" ? "Desactivar" : "Activar"}</button></div>)}{users.length === 0 && <div className="users-empty">Aún no hay cuentas registradas.</div>}</div></div></>;
}
