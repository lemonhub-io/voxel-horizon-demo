export interface TouchInput {
  keys: Record<string, boolean>;
  buttons: Record<number, boolean>;
  dx: number;
  dy: number;
  moveX: number;
  moveY: number;
  moveActive: boolean;
  touchSprint: boolean;
  jumpPressed: boolean;
}

export interface TouchRuntimeGame {
  input: TouchInput;
  settings: { touchSens: number };
  player?: {
    inShip: boolean;
    visor: boolean;
    placeBlock: () => void;
    tryOpenShipPanel: (clientX: number, clientY: number) => boolean;
  };
  onKey: (code: string, event: KeyboardEvent) => void;
}
