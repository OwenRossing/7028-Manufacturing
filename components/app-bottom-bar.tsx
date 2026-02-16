"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusSquare, X } from "lucide-react";

type MenuPoint = {
  x: number;
  y: number;
};

type AddMode = "MANUAL" | "IMPORT_CSV" | "ONSHAPE";

export function AppBottomBar({ completed, total }: { completed: number; total: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get("projectId");
  const [menuPoint, setMenuPoint] = useState<MenuPoint | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("MANUAL");
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    function onGlobalClick() {
      setMenuPoint(null);
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuPoint(null);
        setWizardOpen(false);
      }
    }
    window.addEventListener("click", onGlobalClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("click", onGlobalClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  const menuStyle = useMemo(() => {
    if (!menuPoint) return undefined;
    const width = 260;
    const height = 140;
    const x = Math.min(menuPoint.x, window.innerWidth - width - 8);
    const y = Math.max(8, menuPoint.y - height - 8);
    return { left: x, top: y };
  }, [menuPoint]);

  function openMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setMenuPoint({ x: event.clientX, y: event.clientY });
  }

  function openWizard(nextMode: AddMode) {
    setMode(nextMode);
    setInfo(null);
    setWizardOpen(true);
    setMenuPoint(null);
  }

  function continueWizard() {
    const params = new URLSearchParams();
    if (activeProjectId) params.set("projectId", activeProjectId);
    if (mode === "MANUAL") {
      router.push(`/parts/new${params.toString() ? `?${params.toString()}` : ""}`);
      setWizardOpen(false);
      return;
    }
    if (mode === "IMPORT_CSV") {
      router.push(`/import${params.toString() ? `?${params.toString()}` : ""}`);
      setWizardOpen(false);
      return;
    }
    setInfo("Onshape API import is not wired yet. Use CSV import for now.");
  }

  return (
    <>
      <footer className="fixed bottom-0 left-0 right-0 z-50 h-12 border-t border-[#1f2b3a] bg-[#171d25]">
        <div className="mx-auto flex h-full w-full items-center justify-between px-5 text-sm">
          <button
            onClick={openMenu}
            className="inline-flex items-center gap-2 rounded-[3px] px-2 py-1 text-[#67707b] hover:bg-[#212a37] hover:text-white"
          >
            <PlusSquare className="h-4 w-4" />
            <span>Add Part</span>
          </button>

          <div className="ml-auto text-[#67707b] hover:text-white">
            {completed} of {total} parts complete
          </div>
        </div>
      </footer>

      {menuPoint ? (
        <div
          className="fixed z-[70] w-[260px] border border-[#4a5160] bg-[#3d4450] text-[#dcdedf] shadow-2xl"
          style={menuStyle}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => openWizard("MANUAL")}
            className="block w-full px-6 py-4 text-left hover:bg-[#4a5160]"
          >
            Add Part Manually
          </button>
          <button
            onClick={() => openWizard("ONSHAPE")}
            className="block w-full px-6 py-4 text-left hover:bg-[#4a5160]"
          >
            Grab From Onshape
          </button>
          <button
            onClick={() => openWizard("IMPORT_CSV")}
            className="block w-full px-6 py-4 text-left hover:bg-[#4a5160]"
          >
            Import BOM CSV
          </button>
        </div>
      ) : null}

      {wizardOpen ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[740px] rounded-[6px] border border-[#3f4a5b] bg-[#2b313d] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-[#3f4a5b] px-6 py-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#dcdedf]">Add Part</h2>
                <p className="text-sm text-[#9aa8b8]">Choose how you want to create parts for this project.</p>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="rounded-[3px] border border-[#4b5668] bg-[#364052] p-2 text-[#dcdedf] hover:bg-[#445065]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-6 py-4">
              <label className="block text-sm text-[#9aa8b8]">Mode</label>
              <div className="grid gap-2 md:grid-cols-3">
                <button
                  onClick={() => setMode("MANUAL")}
                  className={`rounded-[4px] border px-3 py-3 text-left ${
                    mode === "MANUAL"
                      ? "border-[#1a9fff] bg-[#1a9fff]/20 text-[#dcdedf]"
                      : "border-[#3f4a5b] bg-[#202833] text-[#b8c2cd] hover:bg-[#273140]"
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setMode("ONSHAPE")}
                  className={`rounded-[4px] border px-3 py-3 text-left ${
                    mode === "ONSHAPE"
                      ? "border-[#1a9fff] bg-[#1a9fff]/20 text-[#dcdedf]"
                      : "border-[#3f4a5b] bg-[#202833] text-[#b8c2cd] hover:bg-[#273140]"
                  }`}
                >
                  Grab From Onshape
                </button>
                <button
                  onClick={() => setMode("IMPORT_CSV")}
                  className={`rounded-[4px] border px-3 py-3 text-left ${
                    mode === "IMPORT_CSV"
                      ? "border-[#1a9fff] bg-[#1a9fff]/20 text-[#dcdedf]"
                      : "border-[#3f4a5b] bg-[#202833] text-[#b8c2cd] hover:bg-[#273140]"
                  }`}
                >
                  Import BOM CSV
                </button>
              </div>
              {info ? (
                <p className="rounded-[3px] border border-yellow-500/40 bg-yellow-500/15 px-3 py-2 text-sm text-yellow-100">
                  {info}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#3f4a5b] px-6 py-4">
              <button
                onClick={() => setWizardOpen(false)}
                className="rounded-[4px] border border-[#4b5668] bg-[#364052] px-4 py-2 text-[#dcdedf] hover:bg-[#445065]"
              >
                Cancel
              </button>
              <button
                onClick={continueWizard}
                className="rounded-[4px] border border-[#2f6eb6] bg-[#1a9fff] px-4 py-2 text-white hover:bg-[#3aaeff]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

