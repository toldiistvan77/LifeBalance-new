import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "./supabase";
import {
  ArrowRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3,
  Compass, Eye, EyeOff, Heart, Home, LogOut, MapPin, Moon, Plus, Search,
  Settings, ShieldCheck, Sun, TicketCheck, Users, X, Leaf, Menu
} from "lucide-react";
import logo from "../images/icon-1x1-512-rounded.png";

type Role = "student" | "teacher" | "admin";
type TeacherStatus = "not_applicable" | "pending" | "approved" | "rejected";
type AuthMode = "login" | "register";
type ResetMode = "none" | "request" | "update";
type Page = "Kezdőlap" | "Események" | "Naptár" | "Jelentkezéseim" | "Kedvencek" | "Saját eseményeim" | "Felhasználók" | "Diákok" | "Beállítások"; type Profile = { id: string; display_name: string; role: Role; teacher_status: TeacherStatus; created_at: string };
type DbEvent = {
  id: string; title: string; description: string; location: string; starts_at: string; ends_at: string;
  registration_deadline: string | null; capacity: number | null; created_by: string;
  status: "draft" | "published" | "cancelled" | "completed"; category?: string;
  image_url: string | null; created_at: string; updated_at: string; registrations_count?: number;
};
type Registration = { id: string; event_id: string; student_id: string; status: "registered" | "cancelled"; created_at: string };
type EventAttendee = {
  event_id: string;
  student_id: string;
  display_name: string;
};

const categories = ["Kirándulás", "Sport", "Közösség", "Kultúra"] as const;
const roleNames: Record<Role, string> = { student: "Diák", teacher: "Tanár", admin: "Adminisztrátor" };
const statusNames: Record<DbEvent["status"], string> = { draft: "Piszkozat", published: "Közzétéve", cancelled: "Lemondva", completed: "Lezárva" };
const weekdays = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

function formatDate(value: string | null | undefined) {
  if (!value) return "Nincs megadva";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nincs megadva";
  return new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function dayKey(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function App() {
  const [sessionUser, setSessionUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [resetMode, setResetMode] = useState<ResetMode>("none");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<"student" | "teacher">("student");
  const [authMessage, setAuthMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<Page>("Kezdőlap");
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [eventAttendees, setEventAttendees] = useState<EventAttendee[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Mind");
  const [notice, setNotice] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DbEvent | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DbEvent | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("lifebalance-theme") === "dark"; } catch { return false; }
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsCompact, setSettingsCompact] = useState(false);
  const [settingsEmail, setSettingsEmail] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date()));

  useEffect(() => {
    try { localStorage.setItem("lifebalance-theme", darkMode ? "dark" : "light"); } catch { /* local storage may be unavailable */ }
  }, [darkMode]);

  function openEventForm(event: DbEvent | null = null) {
    setEditingEvent(event); setSelectedImage(null); setImagePreview(event?.image_url ?? ""); setRemoveImage(false); setShowEventForm(true);
  }
  function closeEventForm() {
    setShowEventForm(false); setEditingEvent(null); setSelectedImage(null); setImagePreview(""); setRemoveImage(false);
  }

  const isStudent = profile?.role === "student";
  const isApprovedTeacher = profile?.role === "teacher" && profile.teacher_status === "approved";
  const isAdmin = profile?.role === "admin";
  const canManageEvents = isApprovedTeacher || isAdmin;

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("id, display_name, role, teacher_status, created_at").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Ehhez a fiókhoz nem található profil. Kérj segítséget az adminisztrátortól.");
    setProfile(data as Profile);
    return data as Profile;
  }, []);


  const loadAppData = useCallback(async (userId: string, userProfile: Profile) => {
    setDataLoading(true);

    try {
      const isAdmin = userProfile.role === "admin";
      const isApprovedTeacher =
        userProfile.role === "teacher" &&
        userProfile.teacher_status === "approved";

      if (isAdmin) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, role, teacher_status, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProfiles((data ?? []) as Profile[]);
      }

      const canViewEvents =
        userProfile.role === "student" || isAdmin || isApprovedTeacher;

      if (!canViewEvents) {
        setEvents([]);
        setRegistrations([]);
        setFavoriteIds([]);
        setProfiles([]);
        setEventAttendees([]);
        return;
      }

      const baseQuery = supabase
        .from("events")
        .select(
          "id,title,description,location,starts_at,ends_at,registration_deadline,capacity,created_by,status,category,image_url,created_at,updated_at"
        )
        .order("starts_at", { ascending: true });

      let eventRequest;

      if (isAdmin) {
        eventRequest = baseQuery;
      } else if (userProfile.role === "teacher") {
        eventRequest = baseQuery.or(
          `status.eq.published,created_by.eq.${userId}`
        );
      } else {
        eventRequest = baseQuery.eq("status", "published");
      }

      const { data: eventRows, error: eventError } = await eventRequest;

      if (eventError) {
        if (eventError.message.toLowerCase().includes("category")) {
          throw new Error(
            "Az events táblából hiányzik a category oszlop. Futtasd le a korábban megadott kiegészítő SQL-t."
          );
        }
        throw eventError;
      }

      const allEvents = (eventRows ?? []) as DbEvent[];
      const eventIds = allEvents.map((event) => event.id);

      const { data: myRegistrationRows, error: myRegistrationError } =
        await supabase
          .from("event_registrations")
          .select("id,event_id,student_id,status,created_at")
          .eq("student_id", userId);

      if (myRegistrationError) throw myRegistrationError;

      let visibleRegistrationRows: Registration[] = [];

      if (isAdmin && eventIds.length > 0) {
        const { data, error } = await supabase
          .from("event_registrations")
          .select("id,event_id,student_id,status,created_at")
          .in("event_id", eventIds);

        if (error) throw error;
        visibleRegistrationRows = (data ?? []) as Registration[];
      } else if (isApprovedTeacher && eventIds.length > 0) {
        const ownEventIds = allEvents
          .filter((event) => event.created_by === userId)
          .map((event) => event.id);

        if (ownEventIds.length > 0) {
          const { data, error } = await supabase
            .from("event_registrations")
            .select("id,event_id,student_id,status,created_at")
            .in("event_id", ownEventIds);

          if (error) throw error;
          visibleRegistrationRows = (data ?? []) as Registration[];
        }
      }

      const allRegistrations = [
        ...new Map(
          [
            ...((myRegistrationRows ?? []) as Registration[]),
            ...visibleRegistrationRows,
          ].map((registration) => [registration.id, registration])
        ).values(),
      ];

      const { data: favoriteRows, error: favoriteError } = await supabase
        .from("favorites")
        .select("event_id")
        .eq("student_id", userId);

      if (favoriteError) throw favoriteError;

      setRegistrations(allRegistrations);
      setFavoriteIds(
        (favoriteRows ?? []).map((row: { event_id: string }) => row.event_id)
      );

      const relevantProfileIds = [
        ...new Set([
          ...allEvents.map((event) => event.created_by),
          ...visibleRegistrationRows
            .filter((registration) => registration.status === "registered")
            .map((registration) => registration.student_id),
        ]),
      ];

      
      let relevantProfiles: Profile[] = [];

      if (isAdmin) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, role, teacher_status, created_at");

        if (error) throw error;
        relevantProfiles = (data ?? []) as Profile[];
      } else if (relevantProfileIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, role, teacher_status, created_at")
          .in("id", relevantProfileIds);

        if (error) throw error;
        relevantProfiles = (data ?? []) as Profile[];
      }

      if (isApprovedTeacher) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, role, teacher_status, created_at")
          .eq("role", "student")
          .order("display_name", { ascending: true });

        if (error) throw error;

        relevantProfiles = [
          ...new Map(
            [
              ...relevantProfiles,
              ...((data ?? []) as Profile[]),
            ].map((p) => [p.id, p])
          ).values(),
        ];
      }

      setProfiles(relevantProfiles);

      const profileNameById = new Map(
        relevantProfiles.map((profile) => [profile.id, profile.display_name])
      );

      setEventAttendees(
        visibleRegistrationRows
          .filter((registration) => registration.status === "registered")
          .map((registration) => ({
            event_id: registration.event_id,
            student_id: registration.student_id,
            display_name:
              profileNameById.get(registration.student_id) || "Névtelen diák",
          }))
      );

      const withCounts = await Promise.all(
        allEvents.map(async (event) => {
          const { count, error } = await supabase
            .from("event_registrations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", event.id)
            .eq("status", "registered");

          if (error) throw error;

          return {
            ...event,
            category: event.category || "Közösség",
            registrations_count: count ?? 0,
          };
        })
      );

      setEvents(withCounts);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Nem sikerült betölteni az adatokat."
      );
    } finally {
      setDataLoading(false);
    }
  }, []);


  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        const { data, error } = await supabase.auth.getSession(); if (error) throw error;
        if (data.session?.user && mounted) {
          const user = data.session.user; const p = await loadProfile(user.id); if (!mounted) return;
          setSessionUser({ id: user.id, email: user.email ?? "", name: p.display_name || user.email?.split("@")[0] || "Felhasználó" });
          await loadAppData(user.id, p);
        }
      } catch (error) { if (mounted) setNotice(error instanceof Error ? error.message : "Nem sikerült betölteni a fiókot."); }
      finally { if (mounted) setLoading(false); }
    };
    void start();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") { setResetMode("update"); setAuthMessage("Adj meg egy új jelszót a fiókodhoz."); return; }
      if (!session?.user) { setSessionUser(null); setProfile(null); setEvents([]); setRegistrations([]); setFavoriteIds([]); setProfiles([]); setLoading(false); }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [loadProfile, loadAppData]);

  async function refresh() {
    if (!sessionUser) return;
    try {
      const p = await loadProfile(sessionUser.id);
      setSessionUser((current) => current ? { ...current, name: p.display_name || current.email.split("@")[0] } : current);
      await loadAppData(sessionUser.id, p);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Nem sikerült frissíteni az adatokat."); }
  }

  async function handleAuthSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setAuthMessage("");
    try {
      if (resetMode === "request") {
        if (!email.trim()) throw new Error("Add meg az e-mail-címedet.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }); if (error) throw error;
        setAuthMessage("Ha ehhez az e-mail-címhez tartozik fiók, elküldtük a visszaállító linket. Nézd meg a levélszemét mappát is.");
      } else if (resetMode === "update") {
        if (password.length < 8) throw new Error("Az új jelszó legalább 8 karakter legyen.");
        const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
        setResetMode("none"); setPassword(""); setAuthMessage("A jelszavadat sikeresen megváltoztattuk. Jelentkezz be az új jelszóval."); await supabase.auth.signOut();
      } else if (authMode === "register") {
        if (!name.trim()) throw new Error("Add meg a teljes nevedet.");
        if (password.length < 8) throw new Error("A jelszó legalább 8 karakter legyen.");
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim(), account_type: accountType } } });
        if (error) throw error;
        setAuthMessage(!data.session ? "A regisztráció elindult. Ha szükséges, ellenőrizd az e-mailjeidet." : accountType === "teacher" ? "A tanári fiók létrejött. Az adminisztrátor jóváhagyásáig csak a tájékoztató oldalt használhatod." : "Sikeres diákregisztráció!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error;
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const p = await loadProfile(data.user.id);
          setSessionUser({ id: data.user.id, email: data.user.email ?? "", name: p.display_name || data.user.email?.split("@")[0] || "Felhasználó" });
          setProfile(p); await loadAppData(data.user.id, p);
        }
      }
    } catch (error) { setAuthMessage(error instanceof Error ? error.message : "Nem sikerült a művelet. Ellenőrizd az adatokat."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setNotice("Nem sikerült kijelentkezni: " + error.message);
    else { setSessionUser(null); setProfile(null); setPage("Kezdőlap"); setNotice(""); }
  }
  async function toggleFavorite(eventId: string) {
    if (!sessionUser || !isStudent) return;
    const already = favoriteIds.includes(eventId);
    const result = already ? await supabase.from("favorites").delete().eq("student_id", sessionUser.id).eq("event_id", eventId) : await supabase.from("favorites").insert({ student_id: sessionUser.id, event_id: eventId });
    if (result.error) setNotice(result.error.message); else await refresh();
  }
  async function toggleRegistration(event: DbEvent) {
    if (!sessionUser || !isStudent) return;
    const active = registrations.find((r) => r.event_id === event.id && r.status === "registered");
    const previous = registrations.find((r) => r.event_id === event.id);
    let result;
    if (active) result = await supabase.from("event_registrations").update({ status: "cancelled" }).eq("id", active.id);
    else if (previous) result = await supabase.from("event_registrations").update({ status: "registered" }).eq("id", previous.id);
    else result = await supabase.from("event_registrations").insert({ event_id: event.id, student_id: sessionUser.id, status: "registered" });
    if (result.error) setNotice(result.error.message); else { setNotice(active ? "A jelentkezésedet visszavontuk." : "Sikeresen jelentkeztél az eseményre."); await refresh(); }
  }

  async function saveEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!sessionUser || !canManageEvents || savingEvent) return;
    const form = new FormData(e.currentTarget); const title = String(form.get("title") ?? "").trim(); const location = String(form.get("location") ?? "").trim();
    if (!title || !location) { setNotice("Add meg az esemény címét és helyszínét."); return; }
    if (selectedImage && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(selectedImage.type)) { setNotice("Csak JPG, PNG, WebP vagy GIF képet tölthetsz fel."); return; }
    if (selectedImage && selectedImage.size > 5 * 1024 * 1024) { setNotice("A kép mérete legfeljebb 5 MB lehet."); return; }
    setSavingEvent(true);
    try {
      let imageUrl = removeImage ? null : editingEvent?.image_url ?? null;
      if (selectedImage) {
        const safeName = selectedImage.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${sessionUser.id}/${crypto.randomUUID()}-${safeName}`;
        const { data: uploaded, error: uploadError } = await supabase.storage.from("event-images").upload(filePath, selectedImage, { cacheControl: "3600", upsert: false, contentType: selectedImage.type });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from("event-images").getPublicUrl(uploaded.path).data.publicUrl;
      }
      const startsAt = String(form.get("starts_at") ?? ""); const endsAt = String(form.get("ends_at") ?? ""); const deadline = String(form.get("registration_deadline") ?? "");
      if (!startsAt || !endsAt || !deadline) throw new Error("Add meg a kezdés, a befejezés és a jelentkezési határidő időpontját.");
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error("A befejezés időpontjának a kezdés után kell lennie.");
      const payload = {
        title, description: String(form.get("description") ?? "").trim(), location,
        category: String(form.get("category") ?? "Közösség"), starts_at: new Date(startsAt).toISOString(), ends_at: new Date(endsAt).toISOString(),
        registration_deadline: new Date(deadline).toISOString(), capacity: String(form.get("capacity") ?? "").trim() ? Number(form.get("capacity")) : null,
        status: String(form.get("status") ?? "draft") as DbEvent["status"], image_url: imageUrl, updated_at: new Date().toISOString()
      };
      const result = editingEvent ? await supabase.from("events").update(payload).eq("id", editingEvent.id) : await supabase.from("events").insert({ ...payload, created_by: sessionUser.id });
      if (result.error) throw result.error;
      setNotice(editingEvent ? "Az esemény módosításai mentve." : "Az esemény létrejött."); closeEventForm(); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Nem sikerült menteni az eseményt."); }
    finally { setSavingEvent(false); }
  }
  async function deleteEvent(event: DbEvent) {
    if (!isAdmin && event.created_by !== sessionUser?.id) return;
    if (!window.confirm(`Biztosan törlöd ezt az eseményt: „${event.title}”?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) setNotice(error.message); else { setNotice("Az eseményt töröltük."); if (selectedEvent?.id === event.id) setSelectedEvent(null); await refresh(); }
  }
  async function setTeacherStatus(user: Profile, status: TeacherStatus) {
    if (!isAdmin) return;
    const { error } = await supabase.from("profiles").update({ role: "teacher", teacher_status: status }).eq("id", user.id);
    if (error) setNotice(error.message); else { setNotice(status === "approved" ? "A tanári fiókot jóváhagytuk." : "A tanári kérelmet elutasítottuk."); await refresh(); }
  }
  async function setUserRole(user: Profile, role: Role) {
    if (!isAdmin || user.id === sessionUser?.id) { setNotice("A saját adminfiókod szerepkörét ezen a felületen nem módosíthatod."); return; }
    const { error } = await supabase.from("profiles").update({ role, teacher_status: role === "teacher" ? "pending" : "not_applicable" }).eq("id", user.id);
    if (error) setNotice(error.message); else { setNotice("A szerepkör módosult."); await refresh(); }
  }

  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesCategory = category === "Mind" || (event.category || "Közösség") === category;
    const matchesSearch = `${event.title} ${event.description} ${event.location} ${event.category ?? ""}`.toLocaleLowerCase("hu-HU").includes(search.toLocaleLowerCase("hu-HU"));
    const matchesPage = page !== "Jelentkezéseim" || registrations.some((r) => r.event_id === event.id && r.status === "registered");
    const matchesFavorites = page !== "Kedvencek" || favoriteIds.includes(event.id);
    const matchesTeacher = page !== "Saját eseményeim" || event.created_by === sessionUser?.id;
    return matchesCategory && matchesSearch && matchesPage && matchesFavorites && matchesTeacher;
  }), [events, category, search, page, registrations, favoriteIds, sessionUser]);

  const nav: { label: Page; icon: typeof Home }[] = isAdmin
    ? [
      { label: "Kezdőlap", icon: Home },
      { label: "Események", icon: Compass },
      { label: "Felhasználók", icon: Users },
      { label: "Diákok", icon: Users },
    ]
    : canManageEvents
      ? [
        { label: "Kezdőlap", icon: Home },
        { label: "Események", icon: Compass },
        { label: "Naptár", icon: CalendarDays },
        { label: "Saját eseményeim", icon: TicketCheck },
        { label: "Diákok", icon: Users },
      ]
      : [
        { label: "Kezdőlap", icon: Home },
        { label: "Események", icon: Compass },
        { label: "Naptár", icon: CalendarDays },
        { label: "Jelentkezéseim", icon: TicketCheck },
        { label: "Kedvencek", icon: Heart },
      ];
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear(); const month = calendarMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const prevTotal = new Date(year, month, 0).getDate();
    return Array.from({ length: Math.ceil((firstWeekday + total) / 7) * 7 }, (_, i) => {
      const day = i - firstWeekday + 1;
      if (day < 1) return { day: prevTotal + day, key: dayKey(new Date(year, month - 1, prevTotal + day)), outside: true };
      if (day > total) return { day: day - total, key: dayKey(new Date(year, month + 1, day - total)), outside: true };
      return { day, key: dayKey(new Date(year, month, day)), outside: false };
    });
  }, [calendarMonth]);
  const eventsOnSelectedDay = visibleEvents.filter((event) => dayKey(event.starts_at) === selectedDay);
  const featuredEvent = visibleEvents.find((event) => event.status === "published" && new Date(event.starts_at) >= new Date()) ?? visibleEvents.find((event) => event.status === "published");
  const activeRegistrations = registrations.filter((r) => r.status === "registered").length;
  const notificationItems = [
    ...(isAdmin ? profiles.filter((p) => p.role === "teacher" && p.teacher_status === "pending").map((p) => ({ title: "Tanári jóváhagyás", detail: `${p.display_name || "Új felhasználó"} jóváhagyásra vár.` })) : []),
    ...(settingsEmail ? events.filter((event) => event.status === "published" && new Date(event.starts_at) >= new Date() && new Date(event.starts_at).getTime() - Date.now() < 7 * 86400000).slice(0, 3).map((event) => ({ title: "Közelgő program", detail: `${event.title} · ${formatDate(event.starts_at)}` })) : [])
  ];

  if (loading) return <main className="auth-page"><section className="auth-form-side"><div className="auth-form-wrap"><h2>LifeBalance</h2><p>Betöltés…</p></div></section></main>;

  if (!sessionUser || resetMode !== "none") return (
    <main className="auth-page">
      <section className="auth-story"><div className="auth-brand"><span className="auth-brand-mark"><img src={logo} alt="LifeBalance" /></span><span>LifeBalance</span></div><div className="auth-story-content"><span className="auth-kicker">TALÁLD MEG AZ EGYENSÚLYT</span><h1>Élj tudatosabban.<br /><em>Kapcsolódj többet.</em></h1><p>Programok, közös élmények és feltöltődés egy helyen.</p><div className="auth-feature-list"><div><span><CalendarDays size={18} /></span><div><strong>Tervezd meg a heted</strong><small>Lásd egy helyen a közelgő eseményeket.</small></div></div><div><span><Heart size={18} /></span><div><strong>Találd meg a kedvenceid</strong><small>Mentsd el a neked tetsző programokat.</small></div></div><div><span><Users size={18} /></span><div><strong>Élj át többet együtt</strong><small>Fedezz fel közösségi élményeket.</small></div></div></div></div><div className="auth-story-footer">Egy kiegyensúlyozottabb mindennapért · © 2026 LifeBalance</div></section>
      <section className="auth-form-side"><div className="auth-mobile-brand"><span className="auth-brand-mark"><Leaf size={20} /></span> LifeBalance</div><div className="auth-form-wrap"><div className="auth-welcome"><span className="auth-form-icon"><ShieldCheck size={20} /></span><span className="auth-kicker">BIZTONSÁGOS BEJELENTKEZÉS</span></div><h2>{resetMode === "request" ? "Jelszó visszaállítása" : resetMode === "update" ? "Új jelszó megadása" : authMode === "login" ? "Jó újra látni!" : "Kezdjük el együtt."}</h2><p className="auth-subtitle">{resetMode === "request" ? "Add meg az e-mail-címedet a visszaállító linkhez." : resetMode === "update" ? "Válassz legalább 8 karakteres új jelszót." : "Lépj be, vagy hozz létre új fiókot."}</p>
        {resetMode === "none" && <div className="auth-mode-switch" role="tablist"><button type="button" className={authMode === "login" ? "selected" : ""} onClick={() => { setAuthMode("login"); setAuthMessage(""); }}>Bejelentkezés</button><button type="button" className={authMode === "register" ? "selected" : ""} onClick={() => { setAuthMode("register"); setAuthMessage(""); }}>Regisztráció</button></div>}
        <form className="auth-form" onSubmit={handleAuthSubmit}>
          {resetMode === "none" && authMode === "register" && <label className="auth-field"><span>Teljes név</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>}
          {resetMode !== "update" && <label className="auth-field"><span>E-mail-cím</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>}
          {resetMode === "none" && authMode === "register" && <label className="auth-field"><span>Fiók típusa</span><select value={accountType} onChange={(e) => setAccountType(e.target.value as "student" | "teacher")}><option value="student">Diák</option><option value="teacher">Tanár – adminisztrátori jóváhagyással</option></select></label>}
          {resetMode !== "request" && <label className="auth-field"><span>{resetMode === "update" ? "Új jelszó" : "Jelszó"}</span><div className="password-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete={authMode === "login" && resetMode === "none" ? "current-password" : "new-password"} required /><button type="button" aria-label={showPassword ? "Jelszó elrejtése" : "Jelszó megjelenítése"} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}
          {resetMode === "none" && authMode === "login" && <div className="auth-form-options"><span /><button type="button" className="auth-text-button" onClick={() => { setResetMode("request"); setAuthMessage(""); }}>Elfelejtetted a jelszavad?</button></div>}
          {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Feldolgozás…" : resetMode === "request" ? "Visszaállító e-mail küldése" : resetMode === "update" ? "Új jelszó mentése" : authMode === "login" ? "Bejelentkezés" : "Fiók létrehozása"}<ArrowRight size={18} /></button>
        </form>{resetMode !== "none" && <button className="auth-text-button back-auth" type="button" onClick={() => { setResetMode("none"); setAuthMessage(""); setPassword(""); }}>Vissza a bejelentkezéshez</button>}</div></section>
    </main>
  );

  if (!profile) return <main className="auth-page"><section className="auth-form-side"><div className="auth-form-wrap"><h2>Nem található profil</h2><p>{notice || "A felhasználói profil nem tölthető be."}</p><button className="auth-submit" onClick={signOut}>Kijelentkezés</button></div></section></main>;
  if (profile.role === "teacher" && profile.teacher_status !== "approved") return <main className="auth-page"><section className="auth-story"><div className="auth-brand"><span className="auth-brand-mark"><img src={logo} alt="LifeBalance" /></span><span>LifeBalance</span></div><div className="auth-story-content"><span className="auth-kicker">TANÁRI FIÓK</span><h1>Köszönjük a<br /><em>jelentkezésed!</em></h1><p>A tanári hozzáféréshez adminisztrátori jóváhagyás szükséges.</p></div></section><section className="auth-form-side"><div className="auth-form-wrap"><span className="auth-form-icon"><Clock3 size={24} /></span><h2>{profile.teacher_status === "rejected" ? "A tanári kérelem elutasítva" : "Jóváhagyásra vár"}</h2><p className="auth-subtitle">{profile.teacher_status === "rejected" ? "Jelenleg nem férsz hozzá a tanári funkciókhoz. Ha szerinted ez tévedés, keresd az adminisztrátort." : "A fiókod létrejött, de a tanári funkciók a jóváhagyásig nem érhetők el."}</p><p><strong>Bejelentkezve:</strong> {sessionUser.email}</p><button className="auth-submit" onClick={signOut}>Kijelentkezés <LogOut size={18} /></button></div></section></main>;

  const initials = sessionUser.name.split(/\s+/).map((part) => part[0] ?? "").slice(0, 2).join("").toLocaleUpperCase("hu-HU");
  return <div className={`app-shell ${darkMode ? "theme-dark" : ""} ${settingsCompact ? "compact-layout" : ""} ${mobileNavOpen ? "mobile-nav-visible" : ""}`}>
    <button className="mobile-scrim" aria-label="Navigáció bezárása" onClick={() => setMobileNavOpen(false)} tabIndex={mobileNavOpen ? 0 : -1} />
    <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`} aria-label="Oldalsó navigáció"><div className="brand"><div className="brand-mark"><img src={logo} alt="LifeBalance" /></div><div><strong>LifeBalance</strong><span>Programok és élmények</span></div><button className="sidebar-close icon-button" aria-label="Navigáció bezárása" onClick={() => setMobileNavOpen(false)}><X size={19} /></button></div><div className="school-label">MENÜ · {roleNames[profile.role].toLocaleUpperCase("hu-HU")}</div>
      <nav className="nav-list" aria-label="Fő navigáció">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => { setPage(label); setMobileNavOpen(false); }}><Icon size={18} /><span>{label}</span>{label === "Jelentkezéseim" && activeRegistrations > 0 && <small className="nav-count">{activeRegistrations}</small>}</button>)}</nav>
      {!isAdmin && <><div className="school-label category-label">KATEGÓRIÁK</div><div className="sidebar-categories"><button className={`category-link ${category === "Mind" ? "selected" : ""}`} onClick={() => { setCategory("Mind"); setPage("Események"); setMobileNavOpen(false); }}><span className="category-dot dot-all" />Minden program</button>{categories.map((c) => <button key={c} className={`category-link ${category === c ? "selected" : ""}`} onClick={() => { setCategory(c); setPage("Események"); setMobileNavOpen(false); }}><span className={`category-dot dot-${c.toLocaleLowerCase("hu-HU")}`} />{c}</button>)}</div></>}
      {canManageEvents && <button className="primary-button sidebar-create" onClick={() => { openEventForm(); setMobileNavOpen(false); }}><Plus size={17} /> Új esemény</button>}
      <div className="sidebar-bottom"><button className={`nav-item settings-link ${page === "Beállítások" ? "active" : ""}`} onClick={() => { setPage("Beállítások"); setMobileNavOpen(false); }}><Settings size={18} /><span>Beállítások</span></button><div className="profile-mini"><div className="avatar">{initials}</div><div className="profile-mini-copy"><strong>{sessionUser.name}</strong><span>{roleNames[profile.role]}</span></div><button className="icon-button logout-button" aria-label="Kijelentkezés" title="Kijelentkezés" onClick={signOut}><LogOut size={16} /></button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><button className="mobile-menu-button icon-button" aria-label="Navigáció megnyitása" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button><div className="breadcrumb"><span className="breadcrumb-brand">LifeBalance</span><ChevronRight size={14} /><span>{page}</span></div><div className="topbar-actions"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Esemény keresése..." /></label><div className="header-action-wrap"><button className="icon-button notification-button" aria-label="Értesítések" title="Értesítések" onClick={() => setNotificationsOpen((v) => !v)}><Bell size={18} />{notificationItems.length > 0 && <span />}</button>{notificationsOpen && <div className="notification-popover"><div className="popover-heading"><strong>Értesítések</strong><button className="plain-icon" onClick={() => setNotificationsOpen(false)} aria-label="Bezárás"><X size={15} /></button></div>{notificationItems.length ? notificationItems.map((item, i) => <div className="notification-item" key={`${item.title}-${i}`}><span className="notification-dot" /><div><strong>{item.title}</strong><p>{item.detail}</p></div></div>) : <p className="notification-empty">Most nincs új értesítés.</p>}</div>}</div><button className="icon-button theme-toggle" aria-label={darkMode ? "Világos mód" : "Sötét mód"} title={darkMode ? "Világos mód" : "Sötét mód"} onClick={() => setDarkMode((v) => !v)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><span className="avatar top-avatar">{initials}</span></div></header>
      <div className="content">{notice && <div className="notice" role="status"><Check size={17} /><span>{notice}</span><button aria-label="Bezárás" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {page === "Kezdőlap" && <section className="listing-page"><div className="welcome-row"><div><div className="eyebrow"><Leaf size={14} /> LIFEBALANCE · {roleNames[profile.role].toLocaleUpperCase("hu-HU")}</div><h1>Szia, {sessionUser.name.split(" ")[0]}! <span className="wave">👋</span></h1><p className="page-subtitle">{isAdmin ? "Itt kezelheted a felhasználókat és az összes eseményt." : canManageEvents ? "Kezeld az eseményeidet és tekintsd át a jelentkezőket." : "Találd meg a következő programot, ami feldobja a heted."}</p></div><span className="date-chip"><CalendarDays size={16} />{new Intl.DateTimeFormat("hu-HU", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span></div>
          {featuredEvent && <section className="hero-card"><div className="hero-image-wrap">{featuredEvent.image_url ? <img src={featuredEvent.image_url} alt="" /> : <div className="hero-art"><span>🌿</span><span>☀️</span><span>✦</span></div>}</div><div className="hero-overlay" /><div className="hero-content"><span className="hero-tag"><Leaf size={13} /> KIEMELT PROGRAM</span><h2>{featuredEvent.title}</h2><p>{featuredEvent.description || "Fedezz fel egy új élményt, és kapcsolódj ki a LifeBalance közösségével."}</p><div className="hero-meta"><span><CalendarDays size={14} />{formatDate(featuredEvent.starts_at)}</span><span><MapPin size={14} />{featuredEvent.location}</span></div><button className="primary-button hero-button" onClick={() => setSelectedEvent(featuredEvent)}>Program részletei <ArrowRight size={16} /></button></div><div className="hero-pagination"><span className="pagination-active" /><span /><span /></div></section>}
          {isAdmin && <div className="stats-grid"><article className="stat-card"><span className="stat-icon"><Users size={19} /></span><div><small>Felhasználók</small><strong>{profiles.length}</strong><button onClick={() => setPage("Felhasználók")}>Kezelés <ChevronRight size={13} /></button></div></article><article className="stat-card"><span className="stat-icon stat-icon-warm"><Clock3 size={19} /></span><div><small>Jóváhagyásra vár</small><strong>{profiles.filter((p) => p.role === "teacher" && p.teacher_status === "pending").length}</strong><button onClick={() => setPage("Felhasználók")}>Kérelmek <ChevronRight size={13} /></button></div></article></div>}
          {canManageEvents && <button className="primary-button home-create" onClick={() => openEventForm()}><Plus size={17} /> Új esemény létrehozása</button>}
          <div className="section-heading section-block"><div><h2>{isAdmin ? "Események áttekintése" : "Közelgő programok"}</h2><p>{isAdmin ? "Az összes esemény és állapotuk" : "Válogatás a következő élményekből"}</p></div><button className="text-button" onClick={() => setPage("Események")}>Összes esemény <ChevronRight size={16} /></button></div>
          <EventList events={visibleEvents.filter((e) => isAdmin || e.status === "published").slice(0, 6)} profiles={profiles} role={profile.role} userId={sessionUser.id} onRegister={toggleRegistration} onFavorite={toggleFavorite} onEdit={openEventForm} onDelete={deleteEvent} favoriteIds={favoriteIds} registrations={registrations} loading={dataLoading} onOpen={setSelectedEvent} />
          <div className="bottom-banner"><span className="banner-icon"><Heart size={19} /></span><div><strong>A jóllét a közös élményekkel kezdődik</strong><p>Mentsd el a kedvenceidet, és tervezd meg előre a hetedet.</p></div><button onClick={() => setPage(isStudent ? "Kedvencek" : "Naptár")}>{isStudent ? "Kedvenceim" : "Naptár megnyitása"} <ArrowRight size={14} /></button></div>
        </section>}
        {page === "Események" && <section className="listing-page"><div className="welcome-row"><div><div className="eyebrow"><Compass size={14} /> PROGRAMOK</div><h1>Események</h1><p className="page-subtitle">Böngészd a LifeBalance programjait, és találd meg a neked valót.</p></div><span className="result-count">{visibleEvents.length} program</span></div><div className="filter-row"><button className={`filter-chip ${category === "Mind" ? "filter-active" : ""}`} onClick={() => setCategory("Mind")}>Mind</button>{categories.map((c) => <button key={c} className={`filter-chip ${category === c ? "filter-active" : ""}`} onClick={() => setCategory(c)}>{c}</button>)}</div><EventList events={visibleEvents} profiles={profiles} role={profile.role} userId={sessionUser.id} onRegister={toggleRegistration} onFavorite={toggleFavorite} onEdit={openEventForm} onDelete={deleteEvent} favoriteIds={favoriteIds} registrations={registrations} loading={dataLoading} onOpen={setSelectedEvent} /></section>}
        {page === "Naptár" && <section className="listing-page"><div className="welcome-row"><div><div className="eyebrow"><CalendarDays size={14} /> NAPTÁR</div><h1>Programnaptár</h1><p className="page-subtitle">Válassz egy napot, és nézd meg az arra tervezett programokat.</p></div></div><div className="calendar-layout"><div className="calendar-preview"><div className="calendar-title"><button className="icon-button" aria-label="Előző hónap" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><div><strong>{new Intl.DateTimeFormat("hu-HU", { month: "long", year: "numeric" }).format(calendarMonth)}</strong><span>{visibleEvents.length} elérhető program</span></div><button className="icon-button" aria-label="Következő hónap" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div><div className="calendar-grid">{weekdays.map((d) => <div className="calendar-weekday" key={d}>{d}</div>)}{calendarDays.map((d, i) => { const hasEvent = visibleEvents.some((e) => dayKey(e.starts_at) === d.key); return <button key={`${d.key}-${i}`} className={`calendar-day ${d.outside ? "muted-day" : ""} ${hasEvent ? "has-event" : ""} ${selectedDay === d.key ? "day-selected" : ""}`} onClick={() => setSelectedDay(d.key)}><span>{d.day}</span>{hasEvent && <i />}</button>; })}</div><button className="calendar-today" onClick={() => { const today = new Date(); setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(dayKey(today)); }}>Ugrás a mai napra</button></div><div className="calendar-results"><div className="section-heading"><div><h2>{new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric" }).format(new Date(`${selectedDay}T12:00:00`))}</h2><p>{eventsOnSelectedDay.length ? `${eventsOnSelectedDay.length} program ezen a napon` : "Nincs program erre a napra"}</p></div></div><EventList events={eventsOnSelectedDay} profiles={profiles} role={profile.role} userId={sessionUser.id} onRegister={toggleRegistration} onFavorite={toggleFavorite} onEdit={openEventForm} onDelete={deleteEvent} favoriteIds={favoriteIds} registrations={registrations} loading={dataLoading} onOpen={setSelectedEvent} /></div></div></section>}
        {(page === "Jelentkezéseim" || page === "Kedvencek" || page === "Saját eseményeim") && <section className="listing-page"><div className="welcome-row"><div><div className="eyebrow"><TicketCheck size={14} /> SAJÁT LISTA</div><h1>{page}</h1><p className="page-subtitle">{page === "Jelentkezéseim" ? "Az aktív eseményjelentkezéseid." : page === "Kedvencek" ? "Az elmentett programjaid." : "Az általad létrehozott események."}</p></div></div><EventList events={visibleEvents} profiles={profiles} role={profile.role} userId={sessionUser.id} onRegister={toggleRegistration} onFavorite={toggleFavorite} onEdit={openEventForm} onDelete={deleteEvent} favoriteIds={favoriteIds} registrations={registrations} loading={dataLoading} onOpen={setSelectedEvent} /></section>}
        {page === "Felhasználók" && isAdmin && <section className="listing-page"><div className="welcome-row"><div><div className="eyebrow"><Users size={14} /> ADMINISZTRÁCIÓ</div><h1>Felhasználók</h1><p className="page-subtitle">Szerepkörök és tanári jóváhagyások kezelése.</p></div></div><div className="admin-user-list">{profiles.map((p) => <article className="event-card admin-user-row" key={p.id}><div className="event-card-body"><div className="admin-user-heading"><h3>{p.display_name || "Névtelen felhasználó"}</h3><span className={`status-badge ${p.teacher_status}`}>{p.role === "teacher" ? p.teacher_status === "approved" ? "Jóváhagyva" : p.teacher_status === "pending" ? "Jóváhagyásra vár" : p.teacher_status === "rejected" ? "Elutasítva" : "Tanár" : roleNames[p.role]}</span></div><p>{roleNames[p.role]} · {p.teacher_status}</p><small>{p.id === sessionUser.id ? "Saját adminfiók" : p.id}</small><div className="admin-user-actions">{p.role === "teacher" && p.teacher_status === "pending" && <><button className="primary-button" onClick={() => setTeacherStatus(p, "approved")}>Jóváhagyás</button><button className="secondary-button" onClick={() => setTeacherStatus(p, "rejected")}>Elutasítás</button></>}<label>Szerepkör <select value={p.role} disabled={p.id === sessionUser.id} onChange={(e) => setUserRole(p, e.target.value as Role)}><option value="student">Diák</option><option value="teacher">Tanár</option><option value="admin">Admin</option></select></label></div></div></article>)}</div></section>}
        
        {page === "Diákok" && canManageEvents && (
          <section className="listing-page">
            <div className="welcome-row">
              <div>
                <div className="eyebrow">
                  <Users size={14} /> DIÁKOK
                </div>
                <h1>Diákok</h1>
                <p className="page-subtitle">
                  A LifeBalance regisztrált diákjainak névsora.
                </p>
              </div>
              <span className="result-count">
                {profiles.filter((p) => p.role === "student").length} diák
              </span>
            </div>

            {dataLoading ? (
              <div className="loading-inline">
                <span className="loading-spinner" />
                Diákok betöltése…
              </div>
            ) : profiles.filter((p) => p.role === "student").length === 0 ? (
              <div className="empty-state">
                <Users size={30} />
                <h3>Még nincsenek megjeleníthető diákok</h3>
                <p>A regisztrált diákok itt fognak megjelenni.</p>
              </div>
            ) : (
              <div className="admin-user-list">
                {profiles
                  .filter((p) => p.role === "student")
                  .sort((a, b) =>
                    a.display_name.localeCompare(b.display_name, "hu")
                  )
                  .map((p) => (
                    <article
                      className="event-card admin-user-row"
                      key={p.id}
                    >
                      <div className="event-card-body">
                        <div className="admin-user-heading">
                          <h3>{p.display_name || "Névtelen diák"}</h3>
                          <span className="status-badge">Diák</span>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        )}

        {page === "Beállítások" && <section className="listing-page settings-page"><div className="welcome-row"><div><div className="eyebrow"><Settings size={14} /> SZEMÉLYRE SZABÁS</div><h1>Beállítások</h1><p className="page-subtitle">Állítsd be, hogyan szeretnéd használni a LifeBalance felületét.</p></div></div><div className="settings-card"><div className="settings-section-heading"><span className="settings-symbol"><Sun size={19} /></span><div><h3>Megjelenés</h3><p>Válaszd ki a számodra kényelmes megjelenést.</p></div></div><div className="setting-row"><div><strong>Sötét mód</strong><small>Sötétebb felület gyengébb fényviszonyokhoz.</small></div><button role="switch" aria-checked={darkMode} className={`switch ${darkMode ? "switch-on" : ""}`} onClick={() => setDarkMode((v) => !v)}><span /></button></div><div className="setting-row"><div><strong>Kompakt elrendezés</strong><small>Kisebb térközök, több tartalom egyszerre.</small></div><button role="switch" aria-checked={settingsCompact} className={`switch ${settingsCompact ? "switch-on" : ""}`} onClick={() => setSettingsCompact((v) => !v)}><span /></button></div><div className="settings-section-heading settings-section-divider"><span className="settings-symbol"><Bell size={19} /></span><div><h3>Értesítések</h3><p>Helyben megjelenő emlékeztetők és jelzések.</p></div></div><div className="setting-row"><div><strong>Programemlékeztetők</strong><small>Mutassa a közelgő eseményeket az értesítések között.</small></div><button role="switch" aria-checked={settingsEmail} className={`switch ${settingsEmail ? "switch-on" : ""}`} onClick={() => setSettingsEmail((v) => !v)}><span /></button></div><div className="settings-section-heading settings-section-divider"><span className="settings-symbol"><ShieldCheck size={19} /></span><div><h3>Fiókadatok</h3><p>A jelenlegi bejelentkezés adatai.</p></div></div><div className="account-details"><div><small>Név</small><strong>{sessionUser.name}</strong></div><div><small>E-mail-cím</small><strong>{sessionUser.email}</strong></div><div><small>Fióktípus</small><strong>{roleNames[profile.role]}</strong></div></div><button className="secondary-button settings-logout" onClick={signOut}><LogOut size={16} /> Kijelentkezés</button></div></section>}
        <footer className="footer"><span>© 2026 LifeBalance · Programok és élmények</span><span><ShieldCheck size={14} /> Supabase-adatbázis</span></footer>
      </div>
    </main>
    {showEventForm && canManageEvents && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeEventForm(); }}><section className="event-modal form-modal" role="dialog" aria-modal="true" aria-labelledby="event-form-title"><button className="modal-close icon-button" onClick={closeEventForm} aria-label="Bezárás"><X size={20} /></button><div className="modal-content"><span className="eyebrow"><CalendarDays size={14} /> PROGRAMKEZELÉS</span><h2 id="event-form-title">{editingEvent ? "Esemény szerkesztése" : "Új esemény"}</h2><form className="auth-form event-edit-form" onSubmit={saveEvent}><div className="auth-field"><span>Borítókép (JPG, PNG, WebP vagy GIF, max. 5 MB)</span><label className="image-upload-button"><span className="image-upload-icon"><Plus size={19} /></span><span className="image-upload-text"><strong>{selectedImage ? "Másik kép kiválasztása" : "Kép kiválasztása"}</strong><small>JPG, PNG, WebP vagy GIF · max. 5 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { const input = e.currentTarget; const file = input.files?.[0] ?? null; if (!file) return; if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) { setNotice("Csak JPG, PNG, WebP vagy GIF képet tölthetsz fel."); input.value = ""; return; } if (file.size > 5 * 1024 * 1024) { setNotice("A kép mérete legfeljebb 5 MB lehet."); input.value = ""; return; } setSelectedImage(file); setRemoveImage(false); setImagePreview(URL.createObjectURL(file)); }} /></label></div>
      {imagePreview && !removeImage && <div className="event-image-preview"><img src={imagePreview} alt="Esemény borítóképének előnézete" /></div>}{(imagePreview || editingEvent?.image_url) && !removeImage && <button type="button" className="secondary-button remove-image-button" onClick={() => { setSelectedImage(null); setImagePreview(""); setRemoveImage(true); }}>Kép eltávolítása</button>}
      <label className="auth-field"><span>Cím</span><input name="title" defaultValue={editingEvent?.title ?? ""} required /></label><label className="auth-field"><span>Leírás</span><textarea name="description" defaultValue={editingEvent?.description ?? ""} rows={3} /></label><label className="auth-field"><span>Helyszín</span><input name="location" defaultValue={editingEvent?.location ?? ""} required /></label><label className="auth-field"><span>Kategória</span><select name="category" defaultValue={editingEvent?.category ?? "Közösség"}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label><div className="form-two-columns"><label className="auth-field"><span>Kezdés</span><input type="datetime-local" name="starts_at" defaultValue={toLocalInput(editingEvent?.starts_at)} required /></label><label className="auth-field"><span>Befejezés</span><input type="datetime-local" name="ends_at" defaultValue={toLocalInput(editingEvent?.ends_at)} required /></label></div><label className="auth-field"><span>Jelentkezési határidő</span><input type="datetime-local" name="registration_deadline" defaultValue={toLocalInput(editingEvent?.registration_deadline)} required /></label><div className="form-two-columns"><label className="auth-field"><span>Férőhelyek száma (üresen korlátlan)</span><input type="number" name="capacity" min="1" defaultValue={editingEvent?.capacity ?? ""} /></label><label className="auth-field"><span>Állapot</span><select name="status" defaultValue={editingEvent?.status ?? "draft"}><option value="draft">Piszkozat</option><option value="published">Közzétéve</option><option value="cancelled">Lemondva</option><option value="completed">Lezárva</option></select></label></div><button className="auth-submit" type="submit" disabled={savingEvent}>{savingEvent ? "Mentés folyamatban…" : "Mentés"}<Check size={18} /></button></form></div></section></div>}
    {selectedEvent && <div className="modal-backdrop detail-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedEvent(null); }}><section className="event-modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="modal-close icon-button" onClick={() => setSelectedEvent(null)} aria-label="Bezárás"><X size={20} /></button>{selectedEvent.image_url ? <img className="modal-image" src={selectedEvent.image_url} alt={`${selectedEvent.title} borítóképe`} /> : <div className="modal-image-placeholder"><Leaf size={42} /><span>LifeBalance program</span></div>}<div className="modal-content"><span className={`event-category category-${(selectedEvent.category ?? "Közösség").toLocaleLowerCase("hu-HU")}`}>{selectedEvent.category ?? "Közösség"}</span><h2 id="detail-title">{selectedEvent.title}</h2>{profiles.find((p) => p.id === selectedEvent.created_by)?.display_name && (<p className="event-publisher"> {profiles.find((p) => p.id === selectedEvent.created_by)?.display_name} </p>)}<p className="modal-description">{selectedEvent.description || "Ehhez a programhoz még nem tartozik részletes leírás."}</p><div className="modal-details"><span><CalendarDays size={17} /><span><strong>Kezdés</strong>{formatDate(selectedEvent.starts_at)}</span></span><span><Clock3 size={17} /><span><strong>Befejezés</strong>{formatDate(selectedEvent.ends_at)}</span></span><span><MapPin size={17} /><span><strong>Helyszín</strong>{selectedEvent.location}</span></span><span><TicketCheck size={17} /><span><strong>Jelentkezési határidő</strong>{formatDate(selectedEvent.registration_deadline)}</span></span><span><Users size={17} /><span><strong>Férőhelyek</strong>{selectedEvent.capacity ? `${selectedEvent.registrations_count ?? 0} / ${selectedEvent.capacity} jelentkező` : "Korlátlan férőhely"}</span></span></div>{(isAdmin || (isApprovedTeacher && selectedEvent.created_by === sessionUser.id)) && (
      <section className="event-registrants">
        <h3>Jelentkezők</h3>
        {eventAttendees.filter((attendee) => attendee.event_id === selectedEvent.id).length > 0 ? (
          <ul>
            {eventAttendees
              .filter((attendee) => attendee.event_id === selectedEvent.id)
              .map((attendee) => (
                <li key={`${attendee.event_id}-${attendee.student_id}`}>
                  {attendee.display_name}
                </li>
              ))}
          </ul>
        ) : (
          <p>Még nincs jelentkező.</p>
        )}
      </section>
    )}<div className="modal-actions">{isStudent && <><button className="primary-button" disabled={selectedEvent.status !== "published" || !selectedEvent.registration_deadline || new Date(selectedEvent.registration_deadline) <= new Date() || (selectedEvent.capacity !== null && (selectedEvent.registrations_count ?? 0) >= selectedEvent.capacity && !registrations.some((r) => r.event_id === selectedEvent.id && r.status === "registered"))} onClick={() => toggleRegistration(selectedEvent)}>{registrations.some((r) => r.event_id === selectedEvent.id && r.status === "registered") ? "Jelentkezés visszavonása" : "Jelentkezem"}</button><button className={`secondary-button ${favoriteIds.includes(selectedEvent.id) ? "favorite-secondary" : ""}`} onClick={() => toggleFavorite(selectedEvent.id)}><Heart size={16} fill={favoriteIds.includes(selectedEvent.id) ? "currentColor" : "none"} />{favoriteIds.includes(selectedEvent.id) ? "Kedvenc" : "Kedvencekhez"}</button></>}{canManageEvents && (isAdmin || selectedEvent.created_by === sessionUser.id) && <><button className="secondary-button" onClick={() => { const e = selectedEvent; setSelectedEvent(null); openEventForm(e); }}>Szerkesztés</button><button className="secondary-button" onClick={() => void deleteEvent(selectedEvent)}>Törlés</button></>}</div></div></section></div>}
  </div>;
}

function EventList(props: {
  events: DbEvent[]; profiles: Profile[]; role: Role; userId: string; onRegister: (event: DbEvent) => void; onFavorite: (eventId: string) => void;
  onEdit: (event: DbEvent) => void; onDelete: (event: DbEvent) => void; favoriteIds: string[]; registrations: Registration[];
  loading: boolean; onOpen: (event: DbEvent) => void;
}) {
  if (props.loading) return <div className="loading-inline"><span className="loading-spinner" />Események betöltése…</div>;
  if (!props.events.length) return <div className="empty-state"><CalendarDays size={30} /><h3>Nincs megjeleníthető esemény</h3><p>Próbálj másik keresést, vagy nézz vissza később új programokért.</p></div>;
  const isStudent = props.role === "student"; const canManage = props.role === "admin" || props.role === "teacher";
  return <div className="event-grid listing-grid">{props.events.map((event) => {
    const registered = props.registrations.some((r) => r.event_id === event.id && r.status === "registered"); const favorite = props.favoriteIds.includes(event.id); const count = event.registrations_count ?? 0; const canEditThis = props.role === "admin" || event.created_by === props.userId;
    const categoryClass = (event.category ?? "Közösség").toLocaleLowerCase("hu-HU");
    const publisherName = props.profiles.find((p) => p.id === event.created_by)?.display_name;
    return <article className="event-card" key={event.id}><button className="event-card-open" onClick={() => props.onOpen(event)} aria-label={`${event.title} részletei`}>{event.image_url ? <img className="event-cover-image" src={event.image_url} alt={`${event.title} borítóképe`} loading="lazy" /> : <div className="event-cover-placeholder"><Leaf size={28} /><span>LifeBalance</span></div>}<div className="event-card-body"><div className="event-card-topline"><span className={`event-category category-${categoryClass}`}>{event.category ?? "Közösség"}</span><span className="card-status">{statusNames[event.status]}</span></div><h3>{event.title}</h3>{publisherName && <p className="event-publisher">{publisherName}</p>}<p className="event-description">{event.description || "További részletekért nyisd meg a programot."}</p><p className="event-date"><CalendarDays size={14} /> {formatDate(event.starts_at)}</p><p className="event-location"><MapPin size={14} /> {event.location}</p><p className="capacity-pill"><Users size={13} />{isStudent ? (event.capacity ? `Legfeljebb ${event.capacity} férőhely` : "Férőhelykorlát nélkül") : `${count}${event.capacity ? ` / ${event.capacity}` : ""} jelentkező`}</p></div></button>
      <div className="event-card-actions">{isStudent && <><button className="primary-button card-register" disabled={event.status !== "published" || !event.registration_deadline || new Date(event.registration_deadline) <= new Date() || (event.capacity !== null && count >= event.capacity && !registered)} onClick={() => props.onRegister(event)}>{registered ? "Visszavonás" : "Jelentkezem"}</button><button className={`icon-button favorite-card ${favorite ? "favorite-secondary" : ""}`} aria-label={favorite ? "Eltávolítás a kedvencekből" : "Hozzáadás a kedvencekhez"} onClick={() => props.onFavorite(event.id)}><Heart size={17} fill={favorite ? "currentColor" : "none"} /></button></>}{canManage && canEditThis && <><button className="secondary-button" onClick={() => props.onEdit(event)}>Szerkesztés</button><button className="secondary-button" onClick={() => props.onDelete(event)}>Törlés</button></>}</div>
    </article>;
  })}</div>;
}

export default App;
