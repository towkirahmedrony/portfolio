import { parseStorageObject } from "@/lib/photos";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function removeStorageObject(imageUrl: string | null | undefined): Promise<void> {
  const object = parseStorageObject(imageUrl);
  if (!object) {
    return;
  }

  const supabase = await createServerSupabaseClient();
  await supabase.storage.from(object.bucket).remove([object.path]);
}
