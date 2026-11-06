// A quiet word about recipe files that didn't make it into the book, so a typo doesn't just look
// like a missing recipe. Only says so: the fix happens in the file, and it comes back once fixed.
import { api } from '../../api.ts';
import { useLoad } from '../../hooks/useLoad.ts';

export function RecipeFileNotices() {
  const { data } = useLoad('recipe-problems', () => api.recipeProblems());
  if (!data?.length) return null;
  return (
    <div className="section stack" style={{ gap: 8 }}>
      {data.map(({ file, problem }) => (
        <p key={file} className="notice" style={{ margin: 0, overflowWrap: 'anywhere' }}>{file} couldn’t be read: {problem}.</p>
      ))}
    </div>
  );
}
