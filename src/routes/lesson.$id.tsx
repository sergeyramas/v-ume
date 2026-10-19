// Старые ссылки 1.x вида /lesson/<id> ведут на путь: модель уроков сменилась.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lesson/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
