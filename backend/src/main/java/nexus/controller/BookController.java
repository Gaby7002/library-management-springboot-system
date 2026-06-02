package nexus.controller;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/books")
@CrossOrigin("*")
public class BookController {

    @GetMapping
    public List<Map<String, Object>> getBooks() {

        List<Map<String, Object>> books = new ArrayList<>();

        Map<String, Object> book1 = new HashMap<>();
        book1.put("id", 1);
        book1.put("title", "Java Programming");
        book1.put("author", "John Smith");

        Map<String, Object> book2 = new HashMap<>();
        book2.put("id", 2);
        book2.put("title", "Spring Boot Guide");
        book2.put("author", "Mary Jane");

        books.add(book1);
        books.add(book2);

        return books;
    }
}