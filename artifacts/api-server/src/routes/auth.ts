import { Router } from "express";

const router = Router();

router.get("/auth/me", (req, res) => {
  const userId = req.headers["x-replit-user-id"] as string | undefined;
  const userName = req.headers["x-replit-user-name"] as string | undefined;
  const userRoles = req.headers["x-replit-user-roles"] as string | undefined;

  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    id: userId,
    name: userName ?? "Adventurer",
    roles: userRoles ?? "",
    email: `${userName ?? userId}@replit`,
  });
});

export default router;
