import { WechatLibraryShell } from "@/components/library/wechat-library-shell";
import { migrateDatabase } from "@/lib/db/migrate";
import { getWechatLibraryPayload } from "@/lib/library/wechat-library-service";

export default function LibraryPage() {
  migrateDatabase();

  const payload = getWechatLibraryPayload();

  return (
    <WechatLibraryShell
      items={payload.items}
      recentActions={payload.recentActions}
    />
  );
}
