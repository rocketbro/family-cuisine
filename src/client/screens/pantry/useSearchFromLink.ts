// What another screen wants searched for when it links here (/pantry?q=salmon). It's only for that
// arrival, so the address goes back to plain /pantry, and the tab doesn't reopen on an old search.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

export function useSearchFromLink(): string {
  const location = useLocation();
  const navigate = useNavigate();
  const [search] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  useEffect(() => {
    if (location.search) navigate(location.pathname, { replace: true, state: location.state });
  }, [location, navigate]);
  return search;
}
