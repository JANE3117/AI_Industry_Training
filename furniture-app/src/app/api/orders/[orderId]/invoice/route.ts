import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getOrderInvoicePdf } from "@/lib/catalogue-api";

// Proxies the catalogue API's invoice PDF — the browser never sees the
// X-Api-Key, it only ever talks to this route.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }

  const { orderId } = await params;

  try {
    const pdf = await getOrderInvoicePdf(orderId);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${orderId}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't fetch that invoice. Please try again." }, { status: 502 });
  }
}
