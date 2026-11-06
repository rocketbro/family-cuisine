import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { UserError } from '../../application/user-error.ts';
import { claudePageFetcher, pageFromReply } from './claude-page-fetcher.ts';

const ASKED = 'https://food.example/soup';
const TEXT = 'Soup. '.repeat(50);
const fetched = (source: unknown, url = ASKED) => [{
  type: 'web_fetch_tool_result',
  content: { type: 'web_fetch_result', url, content: { type: 'document', source } },
}] as unknown as Anthropic.ContentBlock[];

describe('pageFromReply', () => {
  it('takes the page the tool fetched, at the address it ended up on', () => {
    expect(pageFromReply(fetched({ type: 'text', data: TEXT }, `${ASKED}/`), ASKED)).toEqual({ url: `${ASKED}/`, content: TEXT });
  });

  it('says so when the fetch failed', () => {
    const failed = [{ type: 'web_fetch_tool_result', content: { type: 'web_fetch_tool_result_error', error_code: 'url_not_accessible' } }] as unknown as Anthropic.ContentBlock[];
    expect(() => pageFromReply(failed, ASKED)).toThrow(UserError);
    expect(() => pageFromReply(failed, ASKED)).toThrow('couldn’t read');
  });

  it('won’t take the model’s own words for the page', () => {
    expect(() => pageFromReply([{ type: 'text', text: TEXT }] as unknown as Anthropic.ContentBlock[], ASKED)).toThrow('couldn’t read');
  });

  it('refuses a stub of a page and anything that isn’t text', () => {
    expect(() => pageFromReply(fetched({ type: 'text', data: 'Just a moment…' }), ASKED)).toThrow('couldn’t read');
    expect(() => pageFromReply(fetched({ type: 'base64', data: TEXT, media_type: 'application/pdf' }), ASKED)).toThrow('couldn’t read');
  });
});

describe('claudePageFetcher', () => {
  it('needs a key, and a web link, before asking anything', async () => {
    await expect(claudePageFetcher({ apiKey: null, model: 'm' }).fetch(ASKED)).rejects.toThrow('API key');
    await expect(claudePageFetcher({ apiKey: 'k', model: 'm' }).fetch('file:///etc/passwd')).rejects.toThrow('web link');
  });
});
