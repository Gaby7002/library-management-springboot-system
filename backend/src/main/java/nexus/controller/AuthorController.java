package nexus.controller;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/authors")
@CrossOrigin("*")
public class AuthorController {

    @GetMapping
    public List<Map<String, Object>> getAuthors() {

        List<Map<String, Object>> authors = new ArrayList<>();

        Map<String, Object> a1 = new HashMap<>();
        a1.put("id", 1);
        a1.put("name", "John Smith");

        Map<String, Object> a2 = new HashMap<>();
        a2.put("id", 2);
        a2.put("name", "Mary Jane");

        authors.add(a1);
        authors.add(a2);

        return authors;
    }
}