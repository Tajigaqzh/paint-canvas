/** 脏检查逻辑已下沉到缩略图 worker 模块，这里只保留再导出，避免改动既有引用与单测。 */
export { collectDirtyPages } from "@/worker/page-thumbnail/dirtyPages";
