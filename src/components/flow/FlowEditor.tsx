"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  createNode,
  updateNodePositions,
  type NodeInput,
} from "@/lib/actions";
import { FlowNode, type FlowNodeData } from "./FlowNode";
import { NodeConfigPanel, type EditableNode } from "./NodeConfigPanel";
import { type TemplateOption } from "@/components/SequenceBuilder";
import type { VariantStatView } from "@/components/VariantManager";

export interface EditorNode {
  id: string;
  kind: "ACTION" | "DELAY" | "CONDITION";
  actionType: string | null;
  conditionType: string | null;
  delayMinutes: number | null;
  messageBody: string | null;
  posX: number;
  posY: number;
  order: number;
  variants: VariantStatView[];
}

const nodeTypes = { flow: FlowNode };

function toRf(n: EditorNode): Node {
  return {
    id: n.id,
    type: "flow",
    position: { x: n.posX || 250, y: n.posY || n.order * 130 },
    data: {
      kind: n.kind,
      actionType: n.actionType,
      conditionType: n.conditionType,
      delayMinutes: n.delayMinutes,
      messageBody: n.messageBody,
      variantCount: n.variants.length,
    } satisfies FlowNodeData,
  };
}

function linearEdges(ids: string[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < ids.length - 1; i++) {
    edges.push({
      id: `e-${ids[i]}-${ids[i + 1]}`,
      source: ids[i],
      target: ids[i + 1],
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#94a3b8" },
      style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
    });
  }
  return edges;
}

const ADD_OPTIONS: { label: string; input: NodeInput }[] = [
  { label: "＋ 接続リクエスト", input: { kind: "ACTION", actionType: "CONNECT_REQUEST" } },
  { label: "＋ メッセージ", input: { kind: "ACTION", actionType: "MESSAGE", messageBody: "" } },
  { label: "＋ プロフィール閲覧", input: { kind: "ACTION", actionType: "VIEW_PROFILE" } },
  { label: "＋ フォロー", input: { kind: "ACTION", actionType: "FOLLOW" } },
  { label: "＋ 待機", input: { kind: "DELAY", delayMinutes: 1440 } },
  { label: "＋ 条件分岐", input: { kind: "CONDITION", conditionType: "IS_CONNECTED" } },
];

export function FlowEditor({
  sequenceId,
  nodes: initial,
  templates,
}: {
  sequenceId: string;
  nodes: EditorNode[];
  templates: TemplateOption[];
}) {
  // Keep the domain model (with variants etc.) in a ref-backed map for the panel.
  const [domain, setDomain] = useState<Record<string, EditorNode>>(() =>
    Object.fromEntries(initial.map((n) => [n.id, n])),
  );
  const orderRef = useRef<string[]>([...initial].sort((a, b) => a.order - b.order).map((n) => n.id));

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>(initial.map(toRf));
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>(linearEdges(orderRef.current));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rebuildEdges = useCallback(
    (ids: string[]) => {
      orderRef.current = ids;
      setRfEdges(linearEdges(ids));
    },
    [setRfEdges],
  );

  const persistPositions = useCallback(() => {
    const positions = rfNodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));
    void updateNodePositions(sequenceId, positions);
  }, [rfNodes, sequenceId]);

  const handleAdd = useCallback(
    async (input: NodeInput) => {
      setAdding(false);
      // Place the new node below the current lowest one.
      const maxY = rfNodes.reduce((m, n) => Math.max(m, n.position.y), 0);
      const x = rfNodes[0]?.position.x ?? 250;
      const res = await createNode(sequenceId, { ...input, posX: x, posY: maxY + 130 });
      if (!res) return;
      const newNode: EditorNode = {
        id: res.id,
        kind: input.kind,
        actionType: input.actionType ?? null,
        conditionType: input.conditionType ?? null,
        delayMinutes: input.delayMinutes ?? null,
        messageBody: input.messageBody ?? null,
        posX: x,
        posY: maxY + 130,
        order: orderRef.current.length,
        variants: [],
      };
      setDomain((d) => ({ ...d, [res.id]: newNode }));
      setRfNodes((ns) => [...ns, toRf(newNode)]);
      rebuildEdges([...orderRef.current, res.id]);
      setSelectedId(res.id);
    },
    [rfNodes, sequenceId, setRfNodes, rebuildEdges],
  );

  const handleDeleted = useCallback(
    (id: string) => {
      setRfNodes((ns) => ns.filter((n) => n.id !== id));
      rebuildEdges(orderRef.current.filter((x) => x !== id));
      setDomain((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      setSelectedId(null);
    },
    [setRfNodes, rebuildEdges],
  );

  const handleSaved = useCallback(
    (id: string, patch: Partial<EditorNode>) => {
      setDomain((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
      setRfNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  ...(patch.messageBody !== undefined ? { messageBody: patch.messageBody } : {}),
                  ...(patch.delayMinutes !== undefined ? { delayMinutes: patch.delayMinutes } : {}),
                  ...(patch.conditionType !== undefined ? { conditionType: patch.conditionType } : {}),
                },
              }
            : n,
        ),
      );
    },
    [setRfNodes],
  );

  const selected = selectedId ? domain[selectedId] : null;
  const selectedEditable: EditableNode | null = selected
    ? {
        id: selected.id,
        kind: selected.kind,
        actionType: selected.actionType,
        conditionType: selected.conditionType,
        delayMinutes: selected.delayMinutes,
        messageBody: selected.messageBody,
        variants: selected.variants,
      }
    : null;

  const summary = useMemo(() => {
    const acts = orderRef.current.length;
    return `${acts} ステップ`;
  }, [rfNodes.length]);

  return (
    <div className="flex h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative flex-1">
        {/* toolbar */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <div className="relative">
            <button className="btn-primary !py-1.5 shadow" onClick={() => setAdding((v) => !v)}>
              ＋ ステップを追加
            </button>
            {adding ? (
              <div className="absolute left-0 top-11 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                {ADD_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => handleAdd(o.input)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs text-slate-500 shadow-sm backdrop-blur">
            {summary}
          </span>
        </div>

        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onNodeDragStop={persistPositions}
          onPaneClick={() => setSelectedId(null)}
          nodesConnectable={false}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: "smoothstep" }}
        >
          <Background color="#e2e8f0" gap={18} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-slate-50" nodeColor={() => "#93b4f5"} />
        </ReactFlow>
      </div>

      {selectedEditable ? (
        <NodeConfigPanel
          key={selectedEditable.id}
          node={selectedEditable}
          sequenceId={sequenceId}
          templates={templates}
          onClose={() => setSelectedId(null)}
          onSaved={(patch) => handleSaved(selectedEditable.id, patch)}
          onDeleted={() => handleDeleted(selectedEditable.id)}
        />
      ) : null}
    </div>
  );
}
