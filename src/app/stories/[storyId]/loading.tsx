import { LoadingPanel } from "@/components/app/loading-panel";

export default function StoryLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <LoadingPanel
        title="Loading story workspace"
        description="Preparing the selected story page and local workspace state."
      />
    </div>
  );
}
