"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import { useEffect } from "react";

// Extension pour la taille de police
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

// Défini hors du composant : sinon React le voit comme un nouveau type à chaque
// rendu et remonte tous les boutons de la barre à chaque frappe.
function ToolBtn({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
        active
          ? "bg-violet text-cream"
          : "text-muted hover:bg-violet-soft hover:text-violet-deep"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, autoFocus }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, code: false, horizontalRule: false }),
      TextStyle,
      FontSize,
    ],
    content: value?.startsWith("<") ? value : value ? `<p>${value.replace(/\n/g, "</p><p>")}</p>` : "",
    onUpdate({ editor: e }) {
      const html = e.isEmpty ? "" : e.getHTML();
      onChange(html);
    },
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "tiptap-editor outline-none min-h-[96px] text-sm text-ink leading-relaxed",
        "data-placeholder": placeholder ?? "",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    const incoming = value?.startsWith("<") ? value : value ? `<p>${value.replace(/\n/g, "</p><p>")}</p>` : "";
    if (incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const setFontSize = (size: string | null) => {
    if (size) {
      editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
    } else {
      editor.chain().focus().unsetMark("textStyle").run();
    }
  };

  const currentFontSize = editor.getAttributes("textStyle").fontSize as string | undefined;

  return (
    <div className="flex flex-col gap-0 rounded-xl border border-line bg-input focus-within:border-violet">
      {/* Barre d'outils */}
      <div className="flex items-center gap-0.5 border-b border-line px-2 py-1.5">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          {/* icône gras */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
            <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
          </svg>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          {/* icône italique */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="5" x2="11" y2="5" />
            <line x1="13" y1="19" x2="5" y2="19" />
            <line x1="15" y1="5" x2="9" y2="19" />
          </svg>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="2" cy="4" r="1.5" />
            <rect x="5" y="3" width="9" height="2" rx="1" />
            <circle cx="2" cy="8" r="1.5" />
            <rect x="5" y="7" width="9" height="2" rx="1" />
            <circle cx="2" cy="12" r="1.5" />
            <rect x="5" y="11" width="9" height="2" rx="1" />
          </svg>
        </ToolBtn>
        <div className="mx-1 h-4 w-px bg-line" />
        {/* Taille */}
        {(
          [
            { key: "S", size: "11px", title: "Petit", glyph: "10px" },
            { key: "M", size: null, title: "Normal", glyph: "13px" },
            { key: "L", size: "17px", title: "Grand", glyph: "16px" },
          ] as { key: string; size: string | null; title: string; glyph: string }[]
        ).map(({ key, size, title, glyph }) => (
          <ToolBtn
            key={key}
            active={size === null ? !currentFontSize : currentFontSize === size}
            onClick={() => setFontSize(size)}
            title={title}
          >
            {/* glyphe « A » dimensionné pour signifier la taille */}
            <span style={{ fontSize: glyph, lineHeight: 1, fontWeight: 600 }}>A</span>
          </ToolBtn>
        ))}
      </div>

      {/* Zone de saisie */}
      <div className="px-3 py-2.5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
