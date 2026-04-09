export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      ok: false,
      error: "Legacy design-system editing has been archived from the live Studio surface.",
    },
    { status: 410 }
  );
}
