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

  const ToolBtn = ({
    active,
    onClick,
    children,
    title,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
  }) => (
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
          <strong>G</strong>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <em>I</em>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
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
            { label: "S", size: "11px", title: "Petit" },
            { label: "M", size: null, title: "Normal" },
            { label: "L", size: "17px", title: "Grand" },
          ] as { label: string; size: string | null; title: string }[]
        ).map(({ label, size, title }) => (
          <ToolBtn
            key={label}
            active={size === null ? !currentFontSize : currentFontSize === size}
            onClick={() => setFontSize(size)}
            title={title}
          >
            <span style={{ fontSize: label === "S" ? "9px" : label === "L" ? "13px" : "11px" }}>
              {label}
            </span>
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
