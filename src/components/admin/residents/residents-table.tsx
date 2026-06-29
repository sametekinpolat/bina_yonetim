"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Pencil, Trash2, Home } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PersonDialog } from "./person-dialog";
import { RelationshipDialog } from "./relationship-dialog";
import { deletePerson, deleteRelationship } from "@/actions/people";
import { buttonVariants } from "@/components/ui/button";

type FlatOption = { id: number; flatNumber: number };

type Relationship = {
  id: number;
  flatId: number;
  flatNumber: number;
  role: "Ev Sahibi" | "Kiracı";
  moveInDate: string;
  moveOutDate: string | null;
};

type Person = {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  email: string | null;
  relationships: Relationship[];
};

export function ResidentsTable({
  people,
  flats,
}: {
  people: Person[];
  flats: FlatOption[];
}) {
  const [personDialog, setPersonDialog] = useState<{ open: boolean; person?: Person }>({ open: false });
  const [relDialog, setRelDialog] = useState<{
    open: boolean;
    person?: Person;
    relationship?: Relationship;
  }>({ open: false });
  const [isPending, startTransition] = useTransition();

  function handleDeletePerson(id: number) {
    if (!confirm("Bu kişiyi ve tüm daire atamalarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;
    startTransition(() => { void deletePerson(id); });
  }

  function handleDeleteRelationship(id: number) {
    if (!confirm("Bu daire atamasını kaldırmak istediğinize emin misiniz?")) return;
    startTransition(() => { void deleteRelationship(id); });
  }

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-sm text-muted-foreground">{people.length} kişi</p>
        <Button size="sm" onClick={() => setPersonDialog({ open: true })}>
          Kişi Ekle
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad Soyad</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>E-posta</TableHead>
              <TableHead>Daire Atamaları</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Henüz kişi yok.
                </TableCell>
              </TableRow>
            )}
            {people.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-medium">
                  {person.firstName} {person.lastName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {person.phoneNumber ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {person.email ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {person.relationships.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Atanmamış</span>
                    ) : (
                      person.relationships.map((rel) => (
                        <div key={rel.id} className="flex items-center gap-1">
                          <Badge variant="secondary">
                            Daire {rel.flatNumber} · {rel.role}
                          </Badge>
                          {!rel.moveOutDate ? (
                            <span className="text-xs text-muted-foreground">
                              {rel.moveInDate} tarihinden beri
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {rel.moveInDate} → {rel.moveOutDate}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            disabled={isPending}
                            onClick={() => handleDeleteRelationship(rel.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => setRelDialog({ open: true, person, relationship: rel })}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPersonDialog({ open: true, person })}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Kişiyi Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setRelDialog({ open: true, person })}
                      >
                        <Home className="mr-2 h-4 w-4" />
                        Daireye Ata
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        disabled={isPending}
                        onClick={() => handleDeletePerson(person.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Kişiyi Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PersonDialog
        open={personDialog.open}
        onOpenChange={(open) => setPersonDialog({ open })}
        person={personDialog.person}
      />

      {relDialog.person && (
        <RelationshipDialog
          open={relDialog.open}
          onOpenChange={(open) => setRelDialog({ open })}
          personId={relDialog.person.id}
          personName={`${relDialog.person.firstName} ${relDialog.person.lastName}`}
          flats={flats}
          relationship={relDialog.relationship}
        />
      )}
    </>
  );
}
