# UngEkonom designsystem (utkast v0.1)

Grafisk manual och återanvändbara design tokens. Allt är härlett ur ungekonom.se: `index.html`, de publicerade undersidorna och `stitch-assets/`.

| Fil | Innehåll |
| --- | --- |
| `index.html` | Den grafiska manualen: identitet, logotyp, färg, typografi, layout, komponenter, bildspråk, mallar, skrivregler, tokens och luckor. Öppnas direkt i webbläsaren eller på `/designsystem/`. |
| `tokens.css` | CSS-variabler (`--ue-*`). Varje värde är märkt [B] befintligt, [S] standardiserat eller [F] förslag. |
| `tokens.json` | Samma värden i W3C Design Tokens-format, för Figma (Tokens Studio) och Style Dictionary. Genereras från `tokens.css`. |
| `tailwind.preset.js` | Tailwind-preset som återskapar sajtens egna klassnamn och lägger till `accent-*`, `text-muted` och `critical-wash`. |

## Namnstandard

`kategori.roll.variant` i JSON och `--ue-kategori-roll-variant` i CSS. Rollen beskriver användningen, inte färgen: `color.text.secondary`, inte `color.slate.600`.

## Status

Utkast. Manualen kan inte betraktas som fastställd förrän luckorna i kapitel L är beslutade. De viktigaste är att logotypens text konverteras till konturer, att alternativa logotypversioner och favicon tas fram, kontrastbristerna och ett antal skrivregler.
