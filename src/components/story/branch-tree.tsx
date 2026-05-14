import type { StoryBranch } from "@/lib/types";

export default function BranchTree({ branches }: { branches: StoryBranch[] }) {
  return (
    <aside className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Branches</h2>
      <ol className="mt-5 space-y-3 border-l pl-4">
        {branches.map((branch) => (
          <li className="text-sm" key={branch.id}>
            <p className="font-medium">{branch.name}</p>
            <p className="mt-1 text-muted-foreground">
              {branch.divergencePoint}
            </p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
