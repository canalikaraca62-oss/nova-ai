"use client";

import { useEffect, useRef, useState } from "react";

/*
  SYRAVEN — Work Graph, spatial view

  WHAT THIS RENDERS

  Real relationships, and only real ones:

    workspace --contains--> project   (projects.workspace_id)
    project   --contains--> task      (tasks.project_id)

  Both columns exist in the schema and both arrive through authorized,
  session-scoped APIs. No edge here is inferred, weighted, or invented.
  If two nodes are connected on screen, a foreign key says so.

  WHY NOT MORE

  public.ai_memory_relations exists and would be the obvious richer
  source. It is RLS-protected and owner-scoped, and it is still unused
  here: no code in the product writes to it, so it holds zero rows.
  Drawing from it would add nothing but the suggestion of depth.

  WHY IT IS LOADED THIS WAY

  three is ~23 MB installed. It is dynamically imported inside an effect
  so it never enters the initial bundle of any other page, and so a
  device that cannot run it is never asked to download it.

  FALLBACKS ARE NOT DECORATION

  Three conditions skip WebGL entirely and the caller renders a list
  instead:

    - prefers-reduced-motion, which is a request not to be moved
    - no WebGL context at all
    - the import failing for any reason

  The renderer in this environment is SwiftShader — a software
  rasteriser with no GPU — so the scene is deliberately modest: points
  and lines, no lighting model, no post-processing, capped node count. A
  spectacle that drops frames communicates less than a diagram that does
  not.
*/

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly kind: "workspace" | "project" | "task" | "knowledge";
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
}

export interface GraphSceneProps {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** Caps what the software renderer is asked to draw. */
const MAX_RENDERED_NODES = 150;

const KIND_COLOR: Record<GraphNode["kind"], number> = {
  workspace: 0xfafafa,
  project: 0x8b5cf6,
  task: 0x22d3ee,
  knowledge: 0xf59e0b,
};

/**
 * Lays nodes out in three concentric rings by kind.
 *
 * Deterministic, not physics-simulated: the same data always produces
 * the same picture, so a user returning to the page recognises it. A
 * force layout would drift on every mount and imply motion that means
 * nothing.
 */
function layout(
  nodes: readonly GraphNode[],
): Map<string, [number, number, number]> {
  const rings: Record<GraphNode["kind"], number> = {
    workspace: 0,
    project: 3.2,
    task: 6.4,
    knowledge: 8.8,
  };

  const byKind: Record<string, GraphNode[]> = {
    workspace: [],
    project: [],
    task: [],
    knowledge: [],
  };

  for (const node of nodes) byKind[node.kind]?.push(node);

  const positions = new Map<string, [number, number, number]>();

  for (const kind of ["workspace", "project", "task", "knowledge"] as const) {
    const group = byKind[kind] ?? [];
    const radius = rings[kind];

    group.forEach((node, index) => {
      if (group.length === 1 && radius === 0) {
        positions.set(node.id, [0, 0, 0]);
        return;
      }

      const angle = (index / Math.max(group.length, 1)) * Math.PI * 2;

      /* A slight vertical offset per ring gives depth without drift. */
      positions.set(node.id, [
        Math.cos(angle) * radius,
        (rings[kind] / 6.4) * 1.2 - 0.6,
        Math.sin(angle) * radius,
      ]);
    });
  }

  return positions;
}

export default function GraphScene({ nodes, edges }: GraphSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  /*
    Decided once, during the first render, rather than inside an effect.

    Both conditions — a request not to be moved, and the absence of a
    WebGL context — are knowable synchronously and never change for the
    life of the component. Setting them from an effect was a cascading
    render for no reason, which is what react-hooks/set-state-in-effect
    objects to.

    The initialiser is lazy, so it runs on the client only; `window` is
    guarded because this component is dynamically imported with
    ssr: false but the guard costs nothing and removes the assumption.
  */
  const [supported] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }

    const probe = document.createElement("canvas");

    return (
      probe.getContext("webgl2") !== null ||
      probe.getContext("webgl") !== null
    );
  });

  /** Set only when the import fails after we believed it would work. */
  const [failed, setFailed] = useState(false);

  const rendering = supported && !failed;

  useEffect(() => {
    if (!supported) return undefined;

    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const THREE = await import("three");

        if (disposed) return;

        const width = mount.clientWidth || 800;
        const height = mount.clientHeight || 480;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
          55,
          width / height,
          0.1,
          100,
        );
        camera.position.set(0, 5.5, 12);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: true,
        });
        renderer.setPixelRatio(1);
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);

        const drawn = nodes.slice(0, MAX_RENDERED_NODES);
        const positions = layout(drawn);

        /* Edges first, so nodes read as sitting on top of them. */
        const edgePoints: number[] = [];

        for (const edge of edges) {
          const a = positions.get(edge.from);
          const b = positions.get(edge.to);
          if (!a || !b) continue;
          edgePoints.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }

        if (edgePoints.length > 0) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(edgePoints, 3),
          );

          scene.add(
            new THREE.LineSegments(
              geometry,
              new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.18,
              }),
            ),
          );
        }

        /* One point cloud per kind, so each keeps its colour. */
        for (const kind of ["workspace", "project", "task", "knowledge"] as const) {
          const group = drawn.filter((node) => node.kind === kind);
          if (group.length === 0) continue;

          const coords: number[] = [];

          for (const node of group) {
            const position = positions.get(node.id);
            if (position) coords.push(...position);
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(coords, 3),
          );

          scene.add(
            new THREE.Points(
              geometry,
              new THREE.PointsMaterial({
                color: KIND_COLOR[kind],
                size: kind === "workspace" ? 0.42 : 0.26,
                sizeAttenuation: true,
              }),
            ),
          );
        }

        let frame = 0;

        const render = () => {
          if (disposed) return;

          /*
            A slow orbit, and nothing else moves. The rotation conveys
            depth — which node is in front of which — rather than
            implying activity. Nothing here is driven by AI state,
            because nothing about this picture is AI state.
          */
          const t = Date.now() * 0.00008;
          camera.position.set(
            Math.sin(t) * 12,
            5.5,
            Math.cos(t) * 12,
          );
          camera.lookAt(0, 0, 0);

          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };

        render();

        cleanup = () => {
          cancelAnimationFrame(frame);
          renderer.dispose();
          if (renderer.domElement.parentNode === mount) {
            mount.removeChild(renderer.domElement);
          }
        };
      } catch {
        /* Import or context failure falls back to the list. */
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [nodes, edges, supported]);

  return (
    <div
      ref={mountRef}
      data-graph-scene={rendering ? "webgl" : "fallback"}
      className="h-[480px] w-full overflow-hidden rounded-2xl border border-border bg-card"
    >
      {!rendering ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-foreground/50">
          The spatial view is unavailable here. The relationships are
          listed below.
        </div>
      ) : null}
    </div>
  );
}
