// Someone looking over a receipt says or types what to change. Claude works on the lines as they
// stand on their screen, their own taps included, and the answer goes back to the screen, held to
// what a tap could do (`checkedRevision`). Nothing is saved here: that's the review's Save. What
// they said about a recipe isn't applied from here; it comes back as a suggestion for that recipe.
import { canNeverAdd, checkedRevision, reviewRows, settleRows, type ReceiptRow, type ReviewFacts } from '../../domain/receipt-review.ts';
import { onTripList } from '../../domain/receipts.ts';
import type { Deps } from './deps.ts';
import { receiptOnTrip } from './receipts.ts';
import { UserError } from './user-error.ts';

const NOT_UNDERSTOOD = 'Claude couldn’t tell what to change, so nothing changed.';
const LONGEST_RECIPE_WORDS = 1000;

export type ReceiptRevisionInput = { said: string; rows: readonly ReceiptRow[] };
export type ReceiptRevision = {
  rows: ReceiptRow[];
  note: string;
  /** What they said about a recipe, to take to that recipe's own "Tell Claude". */
  recipe: { slug: string; title: string; said: string } | null;
};

export async function reviseReceipt(deps: Deps, id: number, input: ReceiptRevisionInput): Promise<ReceiptRevision> {
  if (!deps.ai.available()) throw new UserError('Changing a receipt by talking needs the Anthropic API key in .env.', 503);
  const receipt = deps.receipts.get(id);
  if (!receipt || receipt.status !== 'ready') throw new UserError('That receipt has already been saved.', 409);
  const said = input.said.trim();
  if (!said) throw new UserError('We didn’t catch anything. Try again a little closer to the phone.');

  const { list, diff } = receiptOnTrip(deps, receipt);
  const pantryNames = deps.pantry.list().map(p => p.name);
  const facts: ReviewFacts = {
    lines: receipt.lines.map(line => ({ pantryItemId: line.pantryItemId, onList: onTripList(list ?? [], line) })),
    pantryNames,
    notOnReceipt: diff.skipped.map(l => l.key),
  };
  // Whatever the phone sent, there's one row per line, and each one a tap could have made.
  const sent = reviewRows(receipt.lines, []).map(row => input.rows.find(r => r.index === row.index) ?? row);
  const before = settleRows(sent.map(row => ({ ...row, name: row.name.trim() || receipt.lines[row.index].name })), facts);
  const recipes = deps.recipes.list();

  const answer = await deps.ai.reviseReceipt({
    said,
    lines: before.map(row => {
      const line = receipt.lines[row.index];
      return {
        index: row.index, printed: line.printed, name: row.name, included: row.included, neverAdd: row.neverAdd,
        canNeverAdd: canNeverAdd(row, facts),
        onList: facts.lines[row.index].onList, insteadOf: row.insteadOf, always: row.always,
      };
    }),
    notOnReceipt: diff.skipped.map(l => ({ key: l.key, name: l.name })),
    pantryNames,
    recipes: recipes.map(r => ({ slug: r.slug, title: r.title })),
  });

  const found = answer.recipe && recipes.find(r => r.slug === answer.recipe!.slug);
  const recipeWords = answer.recipe?.said.trim().slice(0, LONGEST_RECIPE_WORDS) ?? '';
  const recipe = found && recipeWords ? { slug: found.slug, title: found.title, said: recipeWords } : null;
  if (!answer.understood && !recipe) throw new UserError(answer.note.trim() || NOT_UNDERSTOOD, 422);
  return {
    rows: answer.understood ? checkedRevision(answer.lines, before, facts) : before,
    note: answer.note.trim(),
    recipe,
  };
}
