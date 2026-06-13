import { useState, useEffect, useCallback } from "react";
import { Task } from "../lib/types";
import { useToast } from "./use-toast";

const STORAGE_KEY = "smart-todo-tasks";

export function useTasks() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<Task[] | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTasks(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse tasks", e);
      }
    }
    setIsLoaded(true);
  };

  const saveTasks = useCallback((newTasks: Task[], saveHistory = true) => {
    if (saveHistory) {
      setHistory([...tasks]);
    }
    setTasks(newTasks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
  }, [tasks]);

  const addTask = (task: Omit<Task, "id" | "createdAt" | "order" | "completed">) => {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      completed: false,
      createdAt: new Date().toISOString(),
      order: tasks.length,
    };
    saveTasks([...tasks, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    saveTasks(tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const deleteTask = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id));
  };

  const toggleTask = (id: string) => {
    saveTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const clearCompleted = () => {
    saveTasks(tasks.filter((t) => !t.completed));
  };

  const deleteSelected = (ids: Set<string>) => {
    saveTasks(tasks.filter((t) => !ids.has(t.id)));
  };

  const reorderTasks = (reordered: Task[]) => {
    saveTasks(reordered);
  };

  const undo = () => {
    if (history) {
      setTasks(history);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      setHistory(null);
      toast({ title: "Undo successful", description: "Reverted to previous state." });
    }
  };

  const manualSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    toast({ title: "Progress Saved", description: "Your tasks have been explicitly saved." });
  };

  const importTasks = (importedTasks: Task[]) => {
    // Basic merge: keep existing, add new if IDs don't conflict
    const existingIds = new Set(tasks.map(t => t.id));
    const toAdd = importedTasks.filter(t => !existingIds.has(t.id));
    saveTasks([...tasks, ...toAdd]);
  };

  return {
    tasks,
    isLoaded,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    clearCompleted,
    deleteSelected,
    reorderTasks,
    undo,
    canUndo: history !== null,
    manualSave,
    importTasks,
    loadTasks,
  };
}
