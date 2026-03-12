"use client";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Code,
  Send,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
} from "react";
import tippy, { type Instance as TippyInstance } from "tippy.js";

// ─── Mention suggestion list ──────────────────────────────────────
interface MentionUser {
  id: string;
  label: string;
}

interface MentionListProps {
  items: MentionUser[];
  command: (item: MentionUser) => void;
}

const MentionList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  MentionListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) props.command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex(
          (i) => (i + props.items.length - 1) % props.items.length,
        );
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % props.items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return (
      <div className="bg-bg-card rounded-lg shadow-lg border border-border px-3 py-2 text-sm text-text-disabled">
        No results
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-lg shadow-lg border border-border py-1 min-w-[160px] z-[70]">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => selectItem(index)}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            index === selectedIndex
              ? "bg-brand-subtle text-brand"
              : "text-text-primary hover:bg-bg-surface"
          }`}
        >
          @{item.label}
        </button>
      ))}
    </div>
  );
});
MentionList.displayName = "MentionList";

// ─── Mention suggestion config ────────────────────────────────────
function mentionSuggestion(getMentionUsers: () => MentionUser[]) {
  return {
    items: ({ query }: { query: string }) => {
      return getMentionUsers()
        .filter((u) => u.label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);
    },
    render: () => {
      let component: ReactRenderer<
        { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
        MentionListProps
      >;
      let popup: TippyInstance[];

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate(props: any) {
          component?.updateProps(props);
          if (props.clientRect) {
            popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect });
          }
        },
        onKeyDown(props: any) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

// ─── Editor component ─────────────────────────────────────────────
interface SubmitModeProps {
  mode?: "submit";
  onSubmit: (html: string) => void;
  onChange?: never;
  initialContent?: never;
  disabled?: boolean;
  placeholder?: string;
  mentionUsers?: MentionUser[];
}

interface FieldModeProps {
  mode: "field";
  onChange: (html: string) => void;
  onSubmit?: never;
  initialContent?: string;
  disabled?: boolean;
  placeholder?: string;
  mentionUsers?: MentionUser[];
}

type Props = SubmitModeProps | FieldModeProps;

export function RichTextEditor({
  mode = "submit",
  onSubmit,
  onChange,
  initialContent = "",
  disabled = false,
  placeholder = "Add a comment...",
  mentionUsers = [],
}: Props) {
  const mentionUsersRef = useRef(mentionUsers);
  mentionUsersRef.current = mentionUsers;

  const getMentionUsers = useCallback(() => mentionUsersRef.current, []);

  const editor = useEditor({
    immediatelyRender: false,
    content: mode === "field" ? initialContent : "",
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        blockquote: false,
        codeBlock: false,
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: mentionSuggestion(getMentionUsers),
      }),
    ],
    editorProps: {
      attributes: {
        class:
          mode === "field"
            ? "outline-none text-sm text-text-primary min-h-[80px] max-h-[200px] overflow-y-auto px-3 pt-3 pb-1 prose prose-sm prose-invert max-w-none"
            : "outline-none text-sm text-text-primary min-h-[40px] max-h-[120px] overflow-y-auto px-3 pt-3 pb-1 prose prose-sm prose-invert max-w-none",
      },
      ...(mode === "submit"
        ? {
            handleKeyDown(view: any, event: KeyboardEvent) {
              if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey) {
                event.preventDefault();
                const html = view.state.doc.textContent.trim()
                  ? view.dom.innerHTML
                  : "";
                if (html && onSubmit) {
                  onSubmit(html);
                  view.dispatch(
                    view.state.tr.delete(0, view.state.doc.content.size),
                  );
                }
                return true;
              }
              return false;
            },
          }
        : {}),
    },
    onUpdate: ({ editor: ed }) => {
      if (mode === "field" && onChange) {
        onChange(ed.getHTML());
      }
    },
  });

  const handleSubmit = () => {
    if (!editor || editor.isEmpty || !onSubmit) return;
    onSubmit(editor.getHTML());
    editor.commands.clearContent();
  };

  if (!editor) return null;

  const btnCls = (active: boolean) =>
    `p-1 rounded transition-colors ${
      active
        ? "bg-brand-subtle text-brand"
        : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
    }`;

  return (
    <div className="bg-bg-card border border-border rounded-lg overflow-hidden focus-within:border-border">
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between px-2 pb-2 pt-1 border-t border-border bg-bg-surface">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btnCls(editor.isActive("bold"))}
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={btnCls(editor.isActive("italic"))}
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={btnCls(editor.isActive("underline"))}
          >
            <UnderlineIcon size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btnCls(editor.isActive("bulletList"))}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={btnCls(editor.isActive("orderedList"))}
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={btnCls(editor.isActive("code"))}
          >
            <Code size={14} />
          </button>
          <span className="text-[10px] text-text-disabled ml-2">@mention</span>
        </div>
        {mode === "submit" && (
          <button
            onClick={handleSubmit}
            disabled={disabled || editor.isEmpty}
            className="p-1.5 bg-brand hover:bg-brand-hover text-white rounded disabled:opacity-30 transition-colors"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
