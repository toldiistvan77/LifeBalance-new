# LifeBalance – frontend prototípus

React + TypeScript + Vite alapú, mintaadatokkal működő UI-prototípus a Mátészalkai SZC Gépészeti Technikum és Kollégium eseménynaptárához.

## Szükséges eszközök

- Node.js LTS
- Visual Studio Code
- Git (ajánlott)

## Indítás

A projekt mappájában futtasd:

```bash
npm install
npm run dev
```

A terminálban megjelenő helyi címet (általában `http://localhost:5173`) nyisd meg böngészőben.

## Build ellenőrzés

```bash
npm run build
```

## Valódi hitelesítés beállítása (Supabase)

1. Hozz létre egy projektet a Supabase-ben.
2. Másold a `.env.example` fájlt `.env` néven, és töltsd ki a projekt URL-jét és a publikus anon kulcsot. Ezeket a Supabase projekt API-beállításainál találod.
3. A Supabase Auth beállításaiban engedélyezd az e-mailes regisztrációt, és ellenőrizd az e-mail-megerősítés / átirányítási URL beállításait.
4. Indítsd újra a fejlesztői szervert a környezeti változók betöltéséhez.

**Biztonság:** a `service_role` kulcsot soha ne tedd frontendbe vagy `.env`-be `VITE_` előtaggal. A frontend csak a publikus anon kulcsot használhatja. A valós hitelesítés most Supabase Authon keresztül történik; az események, jelentkezések és kedvencek mentése továbbra is bemutatóadat.

## Mi működik a prototípusban?

- Kétoldalas, reszponzív bejelentkezési és regisztrációs felület
- Jelszó megjelenítése/elrejtése
- Bemutató módba lépés a felület kipróbálásához

- Oldalsávos navigáció
- Kezdőlap és kiemelt esemény
- Keresés és kategóriaszűrés
- Eseményrészletek felugró ablakban
- Bemutató jelentkezés és visszavonás
- Kedvencek
- Minta naptárnézet
- Világos/sötét mód váltása
- Reszponzív megjelenés mobilon is

## Fontos korlátozások

Ez még **frontend prototípus**. A jelentkezések, kedvencek és a téma választása csak a böngésző memóriájában élnek, újratöltéskor elvesznek. A Supabase hitelesítés a `.env` beállítása után működik. Az események, jelentkezések és kedvencek továbbra sem kerülnek adatbázisba mentésre, és az alkalmazás adatbázis-jogosultságait még ki kell alakítani. A képek internetkapcsolatot igényelnek.

A következő fejlesztési körben érdemes:
1. A tanári/admin felületet és űrlapokat megtervezni.
2. A végleges iskolai arculatot és a belső szövegeket egyeztetni.
3. Supabase-projektet létrehozni, adatmodellt és Row Level Security szabályokat készíteni.
4. A mintaadatokat Supabase-lekérdezésekre cserélni.

## Projektstruktúra

```text
gepeszkor-frontend/
├── src/
│   ├── App.tsx       # Oldalelrendezés és interakciók
│   ├── data.ts       # Mintaesemények és TypeScript-típusok
│   ├── main.tsx      # React belépési pont
│   └── styles.css    # Arculat, reszponzív és sötét téma
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
