import { lazy } from 'react';
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Splash } from "./pages/Splash";
import { isWikiEnabled } from "./utils/featureFlags";

const Auth = lazy(() => import("./pages/Auth").then(m => ({ default: m.Auth })));
const HiBrain = lazy(() => import("./pages/HiBrain").then(m => ({ default: m.HiBrain })));
const ShisiHome = lazy(() => import("./pages/ShisiHome").then(m => ({ default: m.ShisiHome })));
const NoteList = lazy(() => import("./pages/NoteList").then(m => ({ default: m.NoteList })));
const NoteCreate = lazy(() => import("./pages/NoteCreate").then(m => ({ default: m.NoteCreate })));
const DocumentDetail = lazy(() => import("./pages/DocumentDetail").then(m => ({ default: m.DocumentDetail })));
const SiChain = lazy(() => import("./pages/SiChain").then(m => ({ default: m.SiChain })));
const SiCircle = lazy(() => import("./pages/SiCircle").then(m => ({ default: m.SiCircle })));
const Profile = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
const UserProfile = lazy(() => import("./pages/UserProfile").then(m => ({ default: m.UserProfile })));
const Messages = lazy(() => import("./pages/Messages").then(m => ({ default: m.Messages })));
const ConversationDetail = lazy(() => import("./pages/ConversationDetail").then(m => ({ default: m.ConversationDetail })));
const Inbox = lazy(() => import("./pages/Inbox").then(m => ({ default: m.Inbox })));
const DailyReview = lazy(() => import("./pages/DailyReview").then(m => ({ default: m.DailyReview })));
const MyHomepage = lazy(() => import("./pages/MyHomepage").then(m => ({ default: m.MyHomepage })));
const ToastDemo = lazy(() => import("./pages/ToastDemo").then(m => ({ default: m.ToastDemo })));
const WikiList = lazy(() => import("./pages/WikiList").then(m => ({ default: m.WikiList })));
const WikiDetail = lazy(() => import("./pages/WikiDetail").then(m => ({ default: m.WikiDetail })));

const wikiEnabled = isWikiEnabled();

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Splash },
      { path: "auth", Component: Auth },
      { path: "home", Component: ShisiHome },
      { path: "assistant", Component: HiBrain },
      { path: "inbox", Component: Inbox },
      { path: "review/today", Component: DailyReview },
      { path: "siku", Component: NoteList },
      { path: "siku/create", Component: NoteCreate },
      { path: "siku/:id", Component: NoteCreate },
      { path: "documents/:id", Component: DocumentDetail },
      { path: "sichain", Component: SiChain },
      { path: "sicircle", Component: SiCircle },
      { path: "profile", Component: Profile },
      { path: "user/:id", Component: UserProfile },
      { path: "messages/:id", Component: ConversationDetail },
      { path: "messages", Component: Messages },
      { path: "my-homepage", Component: MyHomepage },
      { path: "toast-demo", Component: ToastDemo },
      ...(wikiEnabled ? [
        { path: "wiki", Component: WikiList },
        { path: "wiki/:id", Component: WikiDetail },
      ] : []),
      // Legacy aliases
      { path: "notes", Component: NoteList },
      { path: "create", Component: NoteCreate },
      { path: "notes/:id", Component: NoteCreate },
      { path: "*", Component: Splash },
    ],
  },
]);
