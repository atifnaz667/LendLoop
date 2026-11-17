import type { Metadata } from "next";
import { MyListings } from "@/features/tools/MyListings";

export const metadata: Metadata = { title: "My listings" };

export default function ListingsPage() {
  return <MyListings />;
}
