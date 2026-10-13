export type EventCategory = "Kirándulás" | "Sport" | "Közösség" | "Kultúra";

export type SchoolEvent = {
  id: number;
  title: string;
  description: string;
  category: EventCategory;
  date: string;
  time: string;
  location: string;
  attendees: number;
  capacity: number;
  image: string;
  featured?: boolean;
};

export const events: SchoolEvent[] = [
  {
    id: 1,
    title: "Túra a Zemplénben",
    description: "Közös túra a természetben, jó társaságban. A részletes indulási információkat a jelentkezőknek a szervező tanár küldi el.",
    category: "Kirándulás",
    date: "2026-10-24",
    time: "08:00–18:00",
    location: "Zemplén, Regéci vár környéke",
    attendees: 18,
    capacity: 30,
    image: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
    featured: true
  },
  {
    id: 2,
    title: "Iskolai focibajnokság",
    description: "Álljatok össze csapatokba, és mérjétek össze a tudásotokat egy barátságos bajnokságon!",
    category: "Sport",
    date: "2026-10-28",
    time: "14:00–17:00",
    location: "Iskolai sportpálya",
    attendees: 16,
    capacity: 24,
    image: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: 3,
    title: "Gépész közösségi nap",
    description: "Játékok, csapatfeladatok és közös programok, hogy jobban megismerjük egymást.",
    category: "Közösség",
    date: "2026-11-05",
    time: "10:00–15:00",
    location: "Iskola udvara",
    attendees: 21,
    capacity: 50,
    image: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: 4,
    title: "Kulturális délután",
    description: "Könnyed délutáni program kreatív foglalkozásokkal és közös élményekkel.",
    category: "Kultúra",
    date: "2026-11-12",
    time: "13:30–16:00",
    location: "Díszterem",
    attendees: 9,
    capacity: 35,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80"
  }
];

export const formatEventDate = (date: string) =>
  new Intl.DateTimeFormat("hu-HU", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(new Date(`${date}T12:00:00`));
