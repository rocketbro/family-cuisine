import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isTrustedImageUrl } from '../../domain/image-source.ts';

type Crossing = { isCrossed: (id: string) => boolean; toggle: (id: string) => void };

/** Recipe text can come from a hostile page, so a picture from elsewhere shows as its caption and is never fetched. */
const img: Components['img'] = ({ node: _node, src, alt, ...props }) => (
  isTrustedImageUrl(typeof src === 'string' ? src : undefined) ? <img {...props} src={src} alt={alt} /> : <>{alt}</>
);

/** Renders recipe markdown. With `crossing`, each list item (a step) can be tapped off. */
export function Markdown({ children, crossing }: { children: string; crossing?: Crossing }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={crossing ? {
          img,
          li: ({ node, ...props }) => {
            const id = `step-${node?.position?.start.offset ?? 0}`;
            return <li {...props} className={`crossable ${crossing.isCrossed(id) ? 'crossed' : ''}`} onClick={() => crossing.toggle(id)} />;
          },
        } : { img }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
