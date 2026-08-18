# Come si lavora su questo progetto 👷

Benvenuto. Qui costruiamo **CorpAgent**. Regola d'oro, una sola:

> **Nessuno pubblica sulla versione ufficiale (`main`) senza l'ok di Tommaso.**
> Tu *proponi*, Tommaso *approva*. Sempre.

## Il giro, in 5 passi
1. **Fai una copia di lavoro** (un "ramo") partendo da `main`. Non lavorare mai
   direttamente su `main`.
2. **Fai la tua modifica** — con l'IA che preferisci (va bene anche una gratis).
   Prima leggi **`AGENTS.md`**: sono le regole per non rompere niente.
3. **Apri una proposta** (Pull Request) verso `main`. Compila il modulo che
   compare (cosa hai fatto, perché, come l'hai provata).
4. **Aspetta due cose**:
   - **CodeRabbit** (un'IA) scrive da solo il riepilogo e cosa migliorare;
   - **Tommaso** legge e **approva** (o ti rimanda indietro con le note).
5. Quando Tommaso approva, la modifica **va online da sola**. Fine.

## Le regole che non si rompono
- Mai scrivere su `main`: sempre ramo + proposta.
- Mai mettere chiavi o password nel codice.
- Prima di proporre, controlla che `npx tsc -b --force` e `npm run build`
  passino puliti (i comandi si lanciano da dentro `app/`).
- Non toccare i dati/account veri di Speed Trasporti nei test.
- Le cose delicate (sicurezza, database, agenti che scrivono ai clienti):
  nel dubbio, chiedi a Tommaso PRIMA di farle.

## Dove sono le regole tecniche
- `AGENTS.md` (radice) — le trappole da conoscere, per te e per l'IA.
- `app/CLAUDE.md` — la bibbia completa del progetto.

Nel dubbio: **apri una proposta e chiedi**. Meglio una domanda in più che una
modifica sbagliata online. 🙂
