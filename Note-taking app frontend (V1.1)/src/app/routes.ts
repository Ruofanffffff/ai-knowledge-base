import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Splash } from "./pages/Splash";
import { Auth } from "./pages/Auth";
import { HiBrain } from "./pages/HiBrain";
import { NoteList } from "./pages/NoteList";
import { NoteCreate } from "./pages/NoteCreate";
import { SiChain } from "./pages/SiChain";
import { SiCircle } from "./pages/SiCircle";
import { Profile } from "./pages/Profile";
import { UserProfile } from "./pages/UserProfile";
import { Messages } from "./pages/Messages";
import { MyHomepage } from "./pages/MyHomepage";
import { ToastDemo } from "./pages/ToastDemo";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Splash },
      { path: "auth", Component: Auth },
      { path: "home", Component: HiBrain },
      { path: "siku", Component: NoteList },
      { path: "siku/create", Component: NoteCreate },
      { path: "siku/:id", Component: NoteCreate },
      { path: "sichain", Component: SiChain },
      { path: "sicircle", Component: SiCircle },
      { path: "profile", Component: Profile },
      { path: "user/:id", Component: UserProfile },
      { path: "messages", Component: Messages },
      { path: "my-homepage", Component: MyHomepage },
      { path: "toast-demo", Component: ToastDemo },
      // Legacy aliases
      { path: "notes", Component: NoteList },
      { path: "create", Component: NoteCreate },
      { path: "notes/:id", Component: NoteCreate },
      { path: "*", Component: Splash },
    ],
  },
]);