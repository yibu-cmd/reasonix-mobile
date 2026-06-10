import { Cpu, Activity, DollarSign, Wifi, WifiOff } from "lucide-react";

interface Props {
  modelLabel?: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  cost: string;
  isConnected: boolean;
  turnCount: number;
}

export function StatusBar({ modelLabel, usage, cost, isConnected, turnCount }: Props) {
  return (
    <div className="statusbar">
      <div className="statusbar__left">
        <span className="statusbar__item" title="Connection status">
          {isConnected ? <Wifi size={12} color="var(--color-green)" /> : <WifiOff size={12} color="var(--color-red)" />}
        </span>
        {modelLabel && (
          <span className="statusbar__item">
            <Cpu size={12} />
            <span>{modelLabel}</span>
          </span>
        )}
        {usage && (
          <span className="statusbar__item">
            <Activity size={12} />
            <span>{(usage.totalTokens / 1000).toFixed(1)}k</span>
          </span>
        )}
      </div>
      <div className="statusbar__right">
        <span className="statusbar__item">
          <DollarSign size={12} />
          <span>{cost}</span>
        </span>
        <span className="statusbar__item">{turnCount} turns</span>
      </div>
    </div>
  );
}