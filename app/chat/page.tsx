import { Sidebar } from "@/components/layout/Sidebar"
import { ChatWindow } from "@/components/chat/ChatWindow"
export default function ChatPage() {
  return <div className="flex h-dvh"><div className="hidden md:block"><Sidebar /></div><ChatWindow /></div>
}
