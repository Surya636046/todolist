import { useState, useMemo } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { Task, Priority } from "@/lib/types";
import { useTasks } from "@/hooks/use-tasks";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus, Pencil, Trash2, Check, Search, Filter, Download, Upload,
  Save, Undo2, Sun, Moon, RefreshCw, GripVertical, Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string().optional().nullable(),
  categories: z.string()
});

type FilterType = "all" | "active" | "completed";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const {
    tasks, isLoaded, addTask, updateTask, deleteTask, toggleTask,
    clearCompleted, deleteSelected, reorderTasks, undo, canUndo, manualSave, importTasks, loadTasks
  } = useTasks();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", priority: "medium", dueDate: "", categories: "" }
  });

  const handleOpenAdd = () => {
    form.reset({ title: "", priority: "medium", dueDate: "", categories: "" });
    setEditingTask(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    form.reset({
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate || "",
      categories: task.categories.join(", ")
    });
    setIsAddOpen(true);
  };

  const onSubmit = (data: z.infer<typeof taskSchema>) => {
    const categories = data.categories.split(",").map(s => s.trim()).filter(Boolean);
    const dueDate = data.dueDate || null;
    
    if (editingTask) {
      updateTask(editingTask.id, { title: data.title, priority: data.priority, dueDate, categories });
    } else {
      addTask({ title: data.title, priority: data.priority, dueDate, categories });
    }
    setIsAddOpen(false);
  };

  // Drag and drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIdx = tasks.findIndex(t => t.id === draggedId);
    const targetIdx = tasks.findIndex(t => t.id === targetId);
    
    if (draggedIdx === -1 || targetIdx === -1) return;

    const newTasks = [...tasks];
    const [draggedTask] = newTasks.splice(draggedIdx, 1);
    newTasks.splice(targetIdx, 0, draggedTask);
    
    // Update order values
    const reordered = newTasks.map((t, i) => ({ ...t, order: i }));
    reorderTasks(reordered);
    setDraggedId(null);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleExport = (format: "json" | "csv") => {
    try {
      let content = "";
      let type = "";
      let filename = `tasks-${format(new Date(), "yyyyMMdd-HHmm")}.${format}`;

      if (format === "json") {
        content = JSON.stringify(tasks, null, 2);
        type = "application/json";
      } else {
        const headers = "id,title,completed,priority,dueDate,categories,createdAt,order\\n";
        const rows = tasks.map(t => 
          `"${t.id}","${t.title.replace(/"/g, '""')}","${t.completed}","${t.priority}","${t.dueDate || ''}","${t.categories.join(';')}","${t.createdAt}","${t.order}"`
        ).join("\\n");
        content = headers + rows;
        type = "text/csv";
      }

      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export successful" });
    } catch (e) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const imported = JSON.parse(content);
          importTasks(imported);
          toast({ title: "Import successful" });
        } else {
          toast({ title: "Only JSON import is supported currently", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Import failed", description: "Invalid file format", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = ''; // reset
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (filter === "active") return !t.completed;
        if (filter === "completed") return t.completed;
        return true;
      })
      .filter(t => {
        if (!search) return true;
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.categories.some(c => c.toLowerCase().includes(q));
      })
      .sort((a, b) => a.order - b.order);
  }, [tasks, filter, search]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    return {
      total: tasks.length,
      active: tasks.filter(t => !t.completed).length,
      completed: tasks.filter(t => t.completed).length,
      overdue: tasks.filter(t => !t.completed && t.dueDate && isBefore(new Date(t.dueDate), today)).length
    };
  }, [tasks]);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-8 px-4 sm:px-8">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <CheckSquare className="w-8 h-8" /> Smart To-Do
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} title="Undo">
              <Undo2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { loadTasks(); toast({ title: "Refreshed" }) }} title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle Theme">
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-primary">{stats.active}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-green-600">{stats.completed}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-destructive">{stats.overdue}</div></CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-4 bg-card rounded-xl border shadow-sm">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search tasks..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex bg-muted p-1 rounded-md">
              {(["all", "active", "completed"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-sm rounded-sm capitalize transition-colors ${filter === f ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto md:ml-2">Actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDeleteSelectedOpen(true)} disabled={selectedIds.size === 0}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Selected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={clearCompleted} disabled={stats.completed === 0}>
                  <Check className="w-4 h-4 mr-2" /> Clear Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={manualSave}>
                  <Save className="w-4 h-4 mr-2" /> Save State
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  <Download className="w-4 h-4 mr-2" /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <label className="flex items-center w-full cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" /> Import JSON
                    <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                  </label>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Task List Header */}
        <div className="flex items-center px-2 py-1 text-sm text-muted-foreground font-medium">
          <div className="flex items-center gap-3 w-full">
            <Checkbox 
              checked={filteredTasks.length > 0 && selectedIds.size === filteredTasks.length} 
              onCheckedChange={toggleSelectAll} 
              className="ml-8 mr-2"
            />
            <span>Select All</span>
          </div>
        </div>

        {/* Task List */}
        <div className="flex flex-col gap-2 pb-24">
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-muted-foreground">
                No tasks found.
              </motion.div>
            ) : (
              filteredTasks.map(task => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, task.id)}
                  className={`group flex items-center gap-3 p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-all ${task.completed ? 'opacity-60' : ''}`}
                >
                  <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  
                  <Checkbox 
                    checked={selectedIds.has(task.id)} 
                    onCheckedChange={() => toggleSelect(task.id)}
                  />
                  
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors ${task.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-input hover:border-primary'}`}
                  >
                    {task.completed && <Check className="w-3 h-3" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium truncate ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </span>
                      <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {task.priority}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {task.dueDate && (
                        <span className={`flex items-center gap-1 ${!task.completed && isBefore(new Date(task.dueDate), startOfDay(new Date())) ? 'text-destructive font-medium' : ''}`}>
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.dueDate), "MMM d, yyyy")}
                        </span>
                      )}
                      {task.categories.length > 0 && (
                        <div className="flex gap-1">
                          {task.categories.map(c => (
                            <span key={c} className="bg-muted px-1.5 py-0.5 rounded-sm">#{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(task)} className="h-8 w-8">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(task.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Floating Add Button */}
        <Button 
          size="icon" 
          className="fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-xl hover:shadow-2xl transition-all"
          onClick={handleOpenAdd}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Task Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add New Task"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input placeholder="What needs to be done?" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categories (comma separated)</FormLabel>
                    <FormControl><Input placeholder="work, urgent, home" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full">{editingTask ? "Save Changes" : "Create Task"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this task? This action can be undone later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if(deletingId) deleteTask(deletingId); setDeletingId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Selected Confirmation */}
      <AlertDialog open={deleteSelectedOpen} onOpenChange={setDeleteSelectedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Tasks</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete {selectedIds.size} selected tasks?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteSelected(selectedIds); setSelectedIds(new Set()); setDeleteSelectedOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// Icon fallbacks just in case
function CheckSquare(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>;
}
