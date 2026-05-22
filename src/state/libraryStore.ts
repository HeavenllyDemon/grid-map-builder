import { create } from 'zustand';
import type { Project, ProjectId, ProjectSettings } from '../types';
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
} from '../storage/projects';

interface LibraryState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (input: {
    name: string;
    settings: ProjectSettings;
  }) => Promise<Project>;
  rename: (id: ProjectId, name: string) => Promise<void>;
  duplicate: (id: ProjectId) => Promise<Project | undefined>;
  remove: (id: ProjectId) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await listProjects();
      set({ projects, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  create: async (input) => {
    const project = await createProject(input);
    set({ projects: [project, ...get().projects] });
    return project;
  },

  rename: async (id, name) => {
    await renameProject(id, name);
    set({
      projects: get().projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
      ),
    });
  },

  duplicate: async (id) => {
    const source = get().projects.find((p) => p.id === id);
    if (!source) return undefined;
    const copy = await duplicateProject(id, `${source.name} copy`);
    if (copy) set({ projects: [copy, ...get().projects] });
    return copy;
  },

  remove: async (id) => {
    await deleteProject(id);
    set({ projects: get().projects.filter((p) => p.id !== id) });
  },
}));
