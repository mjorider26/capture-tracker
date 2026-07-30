import { redirect } from "next/navigation";

export default function ApplicationHomePage() {
  redirect("/app/today");
}
