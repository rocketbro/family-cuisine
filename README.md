# Cuisine

A meal planner, recipe book and pantry for one family, which you host yourself. You wake up and the
day's meals are planned, and the groceries for them are already in the house.

It's a web app you add to your phone's home screen. One small server runs on a computer at home, and
your family reaches it over a private network such as Tailscale. There's no hosted version, no
accounts and no plans for either: this is a home project shared so other families can run their own.

## A short tour

- **Today**: breakfast, lunch and dinner. Until the next shopping trip, the planner only uses meals
  the pantry already covers, and each night it replaces planned meals the pantry no longer covers.
  Meals you picked yourself are left alone.
- **Week**: the week at a glance, filled in once a week through the days the coming trip covers.
- **Extras**: anything else you mean to make on a day, like a birthday cake, on top of its meals.
  Its ingredients go on the list and it comes off the pantry once it's made. The planner never touches them.
- **Import a meal plan** (Week tab): a photo, typed words or dictation of a plan you already wrote, partial is fine. Claude reads it (it needs a key), you check each meal, which week it means and what it replaces, and nothing saves until you confirm. Then "Fill in the rest" is your choice. It never makes up recipes: a meal with no recipe stays a name.
- **Recipes**: markdown files with a batch multiplier, source credit and photo. Each is good for breakfast, lunch, dinner or Extras (desserts, snacks, sides), and the planner leaves Extras alone. See substitutes when
  you're short on something, and cook mode keeps the screen on while you tap off steps. With Claude,
  import from a link (if a site blocks it, you can have Claude try, or use screenshots), from cookbook photos or by describing the dish, and change a recipe by saying
  what's different: the edit form fills in, marks what Claude changed, and nothing saves until you do.
- **Pantry**: have, low or out for most things, with counts where the number matters. Items can carry
  use-by dates and be kept in several forms (fresh, frozen, canned, dried). Moving something to the
  freezer or back keeps the total the same and says what will happen first.
- **List**: the grocery list for the coming trip, with what's left of the budget. Prices are ones you
  type or that come from receipts.
- **Evening check-in**: a notification asks what you ate and what ran out.
- **The night before**: a recipe can say what has to happen the evening before, like soaking the beans. If it's on tomorrow's plan, the household gets a notification that evening.
- **With Claude**: talk through the pantry or the day's meals, add a receipt photo and let it update
  the pantry, or roll the dice for a meal from what's in the house.

## What you need

| Needed for | What | Notes |
| --- | --- | --- |
| Everything | Node.js 24 or newer | The server runs TypeScript directly with Node's type stripping |
| Everything | macOS or Linux, always on | Developed on macOS. Linux is the same code but less tested. Windows is untested |
| Phones | HTTPS to the server | Install, microphone and notifications need it. [Tailscale](https://tailscale.com) Serve is the documented way |
| Planning, imports, dictation, receipts | Anthropic API key | Optional, and billed by Anthropic per use. Without it you get the simple planner below |
| Recipe photos | Unsplash access key | Optional, free developer app at [unsplash.com/developers](https://unsplash.com/developers) |
| Notifications | VAPID keys, and an HTTPS `PUBLIC_URL` or a `VAPID_SUBJECT` | Optional. `npm run setup` makes the keys. With neither of the others, push stays off and the log says so |
| Dictation | ffmpeg, plus a speech engine | Optional; see [Dictation](#dictation) |

## Quick start

```sh
git clone https://github.com/rocketbro/family-cuisine.git cuisine && cd cuisine
npm install
npm run setup     # makes .env from .env.example and generates VAPID keys
npm run build
npm start
```

Open <http://127.0.0.1:2847>. A new install starts with six starter recipes, an otherwise empty pantry
(salt and water only) and no household details:

1. In **Settings → Who's eating**, say who's eating, how many adult portions a meal should make, and when dinner is.
2. In **Pantry**, add what you have. Until your first shopping day, only meals the pantry covers get
   planned, so Today stays empty until then unless you add enough for a recipe and tap **Plan ahead**.
3. Later days fill in from the recipes straight away, and **List** shows what to buy for them.

`npm run setup` is safe to run again. If you'd rather do it by hand, copy `.env.example` to `.env` and
put the output of `npx web-push generate-vapid-keys` in it.

### Reaching it from your phones

The server listens only on 127.0.0.1. With Tailscale on the server and on each phone:

```sh
tailscale serve --bg --https=443 http://127.0.0.1:2847
```

Set `PUBLIC_URL` in `.env` to the `https://…ts.net` address that prints, and restart. The server answers
only to loopback and that address, so the phone gets a refusal until this is set. On each phone,
open that address and add it to the home screen (on iPhone, Share → Add to Home Screen). Open it from
there, then turn on notifications in Settings → Notifications.

**Don't use `tailscale funnel` or forward a port to it.** See [Security](#security).


If the server's machine also runs other web apps on this name, on other ports, Safari may give the home screen icon of one to another, because it seems to keep one per hostname. On macOS, `scripts/install-own-address.sh` gives Cuisine its own name on the tailnet through a second Tailscale node, leaving your main Tailscale alone. It adds a device and asks you to sign in once. Run it again after signing in, then set `PUBLIC_URL` to the address it prints. The new address means installing on each phone again and turning notifications back on.

### Keeping it running

**macOS:** `npm run service` builds the app and installs a LaunchAgent, which you can name with
`CUISINE_SERVICE_LABEL` (default `local.cuisine`). Logs go to `~/Library/Logs/cuisine.log`. Run it again
to restart after changing `.env` or updating.

**Linux:** `npm run build`, then a systemd user unit. This unit hasn't been run by the author, so check
it with `systemctl --user status cuisine`. Save it as `~/.config/systemd/user/cuisine.service`, with your
path:

```ini
[Unit]
Description=Cuisine

[Service]
ExecStart=/path/to/cuisine/scripts/serve.sh
Restart=always

[Install]
WantedBy=default.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable --now cuisine
loginctl enable-linger "$USER"   # keeps it running when you're logged out
```

`scripts/serve.sh` finds Node 24 on its own: on the `PATH`, in the usual Homebrew folders, or under nvm.

## Settings

The app's Settings screen has this phone's text size, typeface and appearance, then a row for each of
these, which opens its own screen:

- **Who's eating**: the family in your words, portions, dinner time, and names.
- **Shopping**: the next trip, moving just that trip, your usual shopping day, and your ZIP code.
- **How we cook**: your standing rules for Claude.
- **Stock up**: what to buy more of when the budget has room, picked from your Pantry.
- **Claude won't suggest**: meals you've ruled out.
- **Notifications**: whose phone it is, turning them on, sending a test, and what time the night-before reminder goes out.

Everything else goes in `.env`, and needs a restart. All of it is optional.

| Setting | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Turns on Claude: planning, imports, dictation, receipts, the dice |
| `CUISINE_MODEL` | `claude-sonnet-5-5` | Which Claude model to use |
| `UNSPLASH_ACCESS_KEY` | none | Finds a photo for each recipe |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | none | Notifications. Changing them means turning notifications on again on each phone |
| `PORT` | `2847` | The server's port |
| `HOST` | `127.0.0.1` | The address it listens on. Any other address won't start without `ACCESS_TOKEN` or `ALLOW_OPEN_NETWORK=1`; see [Security](#security) |
| `PUBLIC_URL` | `http://127.0.0.1:2847` | The HTTPS address your phones use. The server answers to this host |
| `ALLOWED_HOSTS` | none | More names the server answers to, comma separated, on top of loopback and `PUBLIC_URL`'s host |
| `ACCESS_TOKEN` | none | A shared password of 16 or more characters. Browsers get a sign-in page and a cookie, and scripts send it as a bearer token |
| `ALLOW_OPEN_NETWORK` | off | `1` lets a non-loopback `HOST` start with no `ACCESS_TOKEN`, so everyone who can reach the port has full access |
| `VAPID_SUBJECT` | `PUBLIC_URL`, if HTTPS | The `mailto:` or `https:` contact push services ask for. Set it if `PUBLIC_URL` isn't HTTPS |
| `CUISINE_DATA_DIR` | see [Your data](#your-data) | Where data lives. `~` and relative paths work. `./data` is ignored by git |
| `CUISINE_CLIENT_DIR` | `dist` | Which build of the web app to serve |
| `CUISINE_SERVICE_LABEL` | `local.cuisine` | The LaunchAgent's name on macOS |
| `SHOP_WEEKDAY` | `3` | First shopping day (0 = Sunday), until someone sets it in Settings → Shopping |
| `DINNER_TIME` | `6:30 PM` | Dinner time until someone sets it in Settings → Who's eating |
| `PLAN_WEEKDAY`, `PLAN_TIME` | `0`, `08:00` | When the weekly plan is made and announced |
| `CHECKIN_TIME` | `19:45` | When the evening check-in goes out |
| `NIGHT_BEFORE_TIME` | `17:00` | When the night-before reminder goes out, until someone sets it in Settings → Notifications |
| `ALDI_PRICE_LOOKUP` | off | See [Aldi and Walmart lookups](#aldi-and-walmart-lookups). `on` turns it on |
| `WALMART_PRODUCT_LOOKUP` | off | Same section |
| `FFMPEG` | `ffmpeg` on the `PATH` | Path to ffmpeg, for dictation |
| `PARAKEET_DIR` | a folder under `~/.cache` | Where the Parakeet speech model is, for dictation |
| `FLUIDVOICE_URL` | `http://127.0.0.1:47733` | FluidVoice's local API, for dictation |

## Optional features

**Without an Anthropic key**, you still have the recipe book, the pantry, cook mode, the list, typed
prices and the check-in, and a simple rotation plans meals from your recipes. You add recipes by writing
them yourself (below) and editing them in the app. Link and photo imports, "describe it", dictation,
telling Claude what to change in a recipe, receipt reading, the dice, new dishes from Claude and finding
night-before steps in your recipes all need the key. Without it, the recipe editor just doesn't offer its mic.

**Without notifications**, the app works the same and just doesn't remind you.

### Writing recipes by hand

A recipe is a markdown file in the `recipes` folder of your data directory. The file name, in lowercase
letters, numbers and dashes, is its address. New and edited files show up at once, with no restart. A file that can't be read is left as it is, and the Recipes screen names it and says what's wrong.

```markdown
---
title: Skillet beef and rice
meals: [dinner]          # breakfast, lunch, dinner
serves: 4
time: 35 min             # optional
batch: true              # good to double for leftovers
seasons: [fall, winter]  # optional; leave out for all year
tags: [weeknight]        # optional
night_before: Soak the beans overnight  # optional; see below
---
A sentence or two about the dish.

## Ingredients

- 1 lb ground beef
- 1 yellow onion, chopped
- 1 can diced tomatoes, 15 oz
- 1 cup rice
- salt, to taste
- parsley, chopped (optional)

## Steps

1. Brown the beef and onion.
2. Stir in the rest, cover and cook until the rice is tender.
```

Each ingredient is `[amount] [unit] item[, note] [(optional)]`, and only the `## Ingredients` section is
parsed. The item is what's matched against the pantry, so name it plainly, the way you'd buy it. Units
include g, kg, oz, lb, ml, l, tsp, tbsp, cup, quart, can, clove, slice, pinch and package. `seed/recipes/`
has more examples. If a file can't be read, it's skipped, left as it is and reported in the log.

`night_before` is for a step that has to happen the evening before you cook: soaking dry beans, marinating overnight, an overnight rise, thawing something big in the fridge, or a dish that must chill overnight. "Can be made ahead" doesn't count. Keep it to one short line of plain words (120 characters at most, with no links or markup). Anything else is ignored and stays in the file. With it, the recipe screen shows the step, and when the recipe is on tomorrow's plan, the household gets a notification that evening.

### The night before

A recipe's night-before step shows on its screen and can be changed on its edit sheet. Claude fills it in when
it imports or writes a recipe, and goes through the recipes you already have once, adding the step only where
one is needed and changing nothing else in the file. It never replaces one you set. To see what that pass would do
first, run it on a copy (it needs a key, and costs well under a dollar for a book of dozens of recipes):

```sh
mkdir /tmp/cuisine-copy && cp -R "<your data folder>/recipes" /tmp/cuisine-copy/recipes
CUISINE_DATA_DIR=/tmp/cuisine-copy ANTHROPIC_API_KEY=... node scripts/night-before-backfill.ts
```

It prints each recipe it would change. Otherwise it happens by itself the first time the service runs with a key.

The reminder goes out at the time in Settings → Notifications (5:00 PM unless you change it), if tomorrow's plan
has such a recipe that hasn't been made, including an extra. Several go in one notification. Tapping opens the
recipe, or the day when there are several. It goes out once a day. If the server was down at that time, it still
goes out up to three hours late, and after that stays quiet. A meal that lands on tomorrow after the reminder
time gets no notification, so the Day and recipe screens say what's due tonight, or what was needed last night,
beside the meal. The planner won't choose such a recipe for today, or for tomorrow once the reminder time has passed.
If you choose one yourself, you're told, not stopped.

### Dictation

The phone records and the server transcribes, on your own machine. Without this, the rest of the app
works and the mic buttons tell you dictation isn't set up. It takes three things:

1. **An Anthropic key**, to work out what you meant.
2. **ffmpeg**: `brew install ffmpeg` or `sudo apt install ffmpeg`.
3. **A speech engine**, either of these. Cuisine tries FluidVoice first, then Parakeet.
   - [FluidVoice](https://github.com/altic-dev/FluidVoice), a Mac dictation app, with its local API turned on (`LocalAPIEnabled`).
   - The Parakeet model, run through sherpa-onnx, which is installed with the app. It's roughly a 640 MB
     folder. Download and unpack it from the
     [sherpa-onnx models](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/nemo-transducer-models.html),
     then point `PARAKEET_DIR` at the folder:

     ```sh
     curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2
     tar xf sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2
     ```

### Receipts

Receipts can be photos, screenshots or PDFs. iPhone photos can arrive as HEIC, which only a macOS server
can read. On Linux, Cuisine keeps the file and tells you to add a screenshot or JPEG instead. On iPhone,
Settings → Camera → Formats → Most Compatible avoids HEIC altogether.

### Sales tax

The list estimates sales tax from your ZIP's state, at the grocery rate. Only North Carolina is filled in
(`src/domain/grocery-tax.ts`), and other states show no tax line. Adding your state is one line, if its
food rate is the same statewide.

## Aldi and Walmart lookups

Cuisine can do three things with these two stores. **The two lookups are off unless you turn them on.**
You don't need them. They're a convenience, and the app works without them: type a price once or add a
receipt, and the list remembers it.

Please read this before turning either one on:

- These are undocumented or unofficial as used here. They work today and could break at any time.
- They aren't authorized by Aldi or Walmart, and this project has no connection to either company.
- They may conflict with those companies' terms. Read the
  [ALDI terms](https://www.aldi.us/terms-of-use), the
  [Instacart terms](https://www.instacart.com/terms) and the
  [Walmart terms](https://www.walmart.com/help/article/walmart-com-terms-of-use/3b75080af40340d6bbd596f116fae5a0)
  yourself, and decide for yourself. Each one has language about automated access.
- They're not for commercial use or for building into a distributed product.
- They're for personal use, at your own risk. This project has no hosted version, and nobody runs them on
  your behalf: if you turn one on, it's your server making these requests.
- Both lookups send a Chrome browser's user agent instead of identifying themselves as Cuisine. The sites
  see what looks like an ordinary browser. That's how they work today, and you should know it.

What each one does:

| | How it works | What's documented | What's sent |
| --- | --- | --- | --- |
| **Aldi prices** (`ALDI_PRICE_LOOKUP`) | Starts a guest session on aldi.us and calls the Instacart GraphQL API behind it, using query hashes read from the site's own files. Runs when someone opens the list, for lines with no price or a week-old one | Not documented. [Instacart's developer docs](https://docs.instacart.com/developer_platform_api/get_started/overview) describe a separate, keyed platform, and we found nothing covering this use | Your ZIP and its coordinates, and the names of items on your list |
| **Walmart package sizes** (`WALMART_PRODUCT_LOOKUP`) | Reads the product's name from its public page, to learn the package size, once per product you've linked | A page for people to read, not an API. The page's layout could change at any time | The product's item ID |
| **Walmart cart link** (always available) | A link your phone opens, which puts the list in your cart. Your server doesn't call Walmart for this, and it never checks out | We found no Walmart documentation for this link (`/affil/cart/addToCart`) | Item IDs and quantities, from your phone to Walmart |

The Walmart cart link has no setting because it's only a link a person taps. To use it, match a list line
to a product once (Find, copy the product link, Paste link). If you'd rather not use it, don't match any
products and ignore the Walmart option on the list.

### Turning on Aldi prices

1. Read the list above.
2. Add `ALDI_PRICE_LOOKUP=on` to `.env`.
3. Restart (`npm run service`, your systemd unit, or `npm start`). The startup line in the log should say
   `Aldi lookup on`.
4. In Settings → Shopping, enter your ZIP code under **Aldi prices near**.
5. Open the List with Aldi chosen. Prices fill in over a few seconds per item. A price you type always wins.

### Turning on Walmart package sizes

1. Read the list above.
2. Add `WALMART_PRODUCT_LOOKUP=on` to `.env`.
3. Restart. The startup line in the log should say `Walmart lookup on`.
4. On the List with Walmart chosen, tap Find on a line, open the product you buy, copy its link and tap
   Paste link. Its size is read right away, and the cart quantity follows from it. Products you linked
   while this was off get read on the next restart or the next time you open the list.

To turn either off, remove the line and restart. Nothing else calls those sites after that. Prices and
sizes already saved stay until you change them.

## What goes where

Your data stays on your server except for these:

| Goes to | What | When |
| --- | --- | --- |
| **Anthropic** (if you add a key) | Your household description, kitchen notes, pantry, plan and recipe titles when planning; dictation transcripts; receipts; cookbook photos and the text of pages you import; a recipe you're changing by talking, with your kitchen notes and pantry names; meal plans you import, with kitchen notes and your recipe titles and tags | Each time one of those features runs |
| **Anthropic** (if you add a key) | Each recipe's title, ingredients and steps, with nothing else about your household, to find which ones need something done the night before | Once, when a key is first there; after that only what's left, if a batch failed |
| **Zippopotam.us** | Your ZIP code | When you save one in Settings → Shopping |
| **Unsplash** (if you add a key) | Recipe titles, as search terms | When a recipe has no photo |
| **Aldi / Instacart** (if turned on) | Your ZIP and coordinates, and item names from your list | When someone opens the list and prices are due |
| **Walmart** (if turned on) | Product item IDs | Once per linked product |
| **Walmart**, from the phone | Item IDs and quantities, plus whatever your browser normally sends | When someone taps Find or the cart button |
| **Your browser's push service** (Apple, Google or Mozilla) | Notifications, encrypted | When one goes out |
| **Recipe sites** | A request for the page | When you import from a link. If a site blocks that and you say to try with Claude, Anthropic's fetcher asks for the page instead |

A page imported from a link goes to Anthropic with only the note you typed for that import: no pantry,
kitchen notes or household details, because a page can be written to steer the model. Going through your recipes
for night-before steps works the same way, since some of them came from pages. Speech is
transcribed on your own server: FluidVoice and Parakeet both run locally. The transcript then
goes to Anthropic. Pharmacy and health items on receipts are left out of the records, but the image of the
receipt itself is still sent to Anthropic to be read.

## Security

**There are no user accounts. Anyone who can reach this app has full access to it**: they can read and
change everything, see your receipts, and spend your Anthropic credit.

**Never expose it to the internet.** Don't use Tailscale Funnel, don't forward a port to it, and don't put
it behind a public reverse proxy. Keep it on 127.0.0.1 with `tailscale serve`, which shares it only inside
your tailnet, and only share your tailnet with people you'd hand your kitchen to.

Keep `.env` private: it holds your API keys. It's ignored by git, and `npm run setup` makes it readable
only by you.

What the server does about it:

- **Who it answers to.** Only loopback, `PUBLIC_URL`'s host and `ALLOWED_HOSTS`, which stops other websites
  reaching it through DNS tricks. It also refuses writes that come from another site's page.
- **Listening more widely.** A `HOST` other than loopback won't start without `ACCESS_TOKEN`, unless you set
  `ALLOW_OPEN_NETWORK=1` to say you mean it.
- **Recipe links.** Importing a link won't fetch a private or local address, including after a redirect.
- **Imported pages.** The model is told a page is untrusted, and pictures from anywhere but this server and
  Unsplash don't load in a recipe.
- **Uploads.** A request can be 60 MB at most, and recordings are judged by their contents.

What it doesn't do, so you can decide for yourself:

- `ACCESS_TOKEN` is one shared password, not accounts, and nothing limits how many guesses someone can make.
  Make it long and put TLS in front of it, because it crosses the network with every sign-in. It doesn't make
  the warning above safe to ignore. Without it, everyone on an allowed network has full access.
- Through a proxy (`NODE_USE_ENV_PROXY`), the proxy resolves names, so the recipe link check can't catch a name
  whose DNS answer changes after the check.
- A private or tailnet recipe link is refused, and there's no setting to allow one.
- Some recipe sites block automated requests. If one does, Cuisine says so and asks before trying again with Claude, which uses Anthropic's web fetch tool: it doesn't pose as a browser, and it may be blocked too. Getting past a site's block is your call, and the site's terms still apply, so keep this to saving recipes for your own kitchen. Screenshots through the Photos tab always work.
- Prompt injection isn't fully closed off. Links in an imported recipe still work if someone taps them, and
  a saved recipe's text reaches the model in later planning and dictation.
- Nothing limits how many uploads run at once, so someone with access can fill memory or disk with 60 MB
  requests.

## Your data

Everything lives in one folder: `~/Library/Application Support/Cuisine` on macOS, and
`~/.local/share/cuisine` (or `$XDG_DATA_HOME/cuisine`) on Linux. Set `CUISINE_DATA_DIR` to move it.

| In the folder | What |
| --- | --- |
| `cuisine.db` | Pantry, plan, check-ins, prices, settings (SQLite) |
| `recipes/` | Your recipes, as markdown |
| `images/` | Recipe photos |
| `receipts/` | Receipts you've kept |
| `recordings/` | Dictation originals |

**Backups:** copy the whole folder while the server is stopped, along with your `.env`. The database runs
in WAL mode, so copying it while the server runs can miss recent changes. To back up without stopping it,
use `sqlite3 cuisine.db ".backup backup.db"` for the database and copy the other folders as they are.

**How long things stay:**

- **Recordings** are deleted once they're a week old, checked daily. They can also be discarded sooner in the
  app. The server holds 300 recordings or 2 GB at most, and past that it refuses new ones, which stay on the
  phone for Retry.
- **Receipts** you save have no time limit and are never deleted automatically, because they're a household
  record: deleting them is up to you. The server stops taking new ones at 5 GB. A receipt saved as prices
  only isn't kept.
- **Everything else** stays until you remove it.

## Adapting it to your family

Settings covers most of this: who's eating, portions, dinner time and names. Kitchen notes (**How we cook**)
are your standing rules, in your words, and Claude follows them when it plans and writes recipes, except
when importing from a link, where they stay out of the page's prompt. They're also where to explain your own names for things ("concentrate means the chicken broth"), because dictation
reads them too.

Some things are still built around one way of eating and shopping, and changing them means changing code:

- The list knows two stores, Aldi and Walmart. You can use it for any store by ignoring the names, but the
  labels stay.
- Prompts in `src/server/infrastructure/ai/prompts.ts` assume a small rotation of breakfasts, quick lunches
  and dinner as the main meal.
- Substitutes are in `src/domain/substitute-rules.ts`, and sales tax rates in `src/domain/grocery-tax.ts`.
- Prices and ZIP codes assume the US.

## Developing

```sh
npm run check        # typecheck, lint and tests
npm run dev:server   # the API on 2848
npm run dev          # Vite on 5173, proxying to it
```

For a throwaway copy with its own data, run it with `PORT` and `CUISINE_DATA_DIR` set to something else.
`AGENTS.md` has the architecture rules and the facts worth knowing.

```
src/domain/       pure rules: units, scaling, pantry matching, availability, planning, shopping, check-in
src/shared/       response shapes shared by server and client (domain imports only)
src/server/
  application/    use cases and the ports they need (listen.ts: everything said or typed)
  infrastructure/ SQLite, recipe files, Claude, Unsplash, transcription, web push, page fetching
  http/           Hono routes, one file per area
  container.ts    the one place adapters are wired to ports
  main.ts         startup and the scheduler
src/client/       React app: screens/, ui/, dictation/, hooks/, styles/
seed/             what a brand-new install starts with: staples and starter recipes
```

## License

[MIT](LICENSE).
